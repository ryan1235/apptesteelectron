export type LogCategory =
  | 'SYSTEM'
  | 'WS-TX'
  | 'WS-RX'
  | 'AUDIO'
  | 'VIDEO-GPU'
  | 'API'
  | 'ERROR';

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS';

export interface LogEntry {
  id: string;
  timestamp: string;
  category: LogCategory;
  level: LogLevel;
  message: string;
  data?: any;
}

type LogListener = (logs: LogEntry[]) => void;

class AppLogger {
  private logs: LogEntry[] = [];
  private maxLogs: number = 500;
  private listeners: Set<LogListener> = new Set();

  constructor() {
    this.hookConsole();
  }

  private hookConsole() {
    // Keep reference to native console
    const originalError = console.error.bind(console);
    const originalWarn = console.warn.bind(console);

    console.error = (...args: any[]) => {
      originalError(...args);
      try {
        const msg = args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
        this.add('ERROR', 'ERROR', msg);
      } catch (e) {}
    };

    console.warn = (...args: any[]) => {
      originalWarn(...args);
      try {
        const msg = args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
        this.add('SYSTEM', 'WARN', msg);
      } catch (e) {}
    };
  }

  public add(category: LogCategory, level: LogLevel, message: string, data?: any) {
    const entry: LogEntry = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString() + '.' + String(Date.now() % 1000).padStart(3, '0'),
      category,
      level,
      message,
      data,
    };

    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    this.notify();
  }

  public info(category: LogCategory, message: string, data?: any) {
    this.add(category, 'INFO', message, data);
  }

  public success(category: LogCategory, message: string, data?: any) {
    this.add(category, 'SUCCESS', message, data);
  }

  public warn(category: LogCategory, message: string, data?: any) {
    this.add(category, 'WARN', message, data);
  }

  public error(category: LogCategory, message: string, data?: any) {
    this.add(category, 'ERROR', message, data);
  }

  public getLogs(): LogEntry[] {
    return [...this.logs];
  }

  public clear() {
    this.logs = [];
    this.notify();
  }

  public subscribe(listener: LogListener): () => void {
    this.listeners.add(listener);
    listener(this.getLogs());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const current = this.getLogs();
    this.listeners.forEach((l) => {
      try {
        l(current);
      } catch (e) {}
    });
  }

  public exportAsString(): string {
    return this.logs
      .map((l) => `[${l.timestamp}] [${l.level}] [${l.category}] ${l.message} ${l.data ? JSON.stringify(l.data) : ''}`)
      .join('\n');
  }
}

export const logger = new AppLogger();

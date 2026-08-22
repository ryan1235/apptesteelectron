import { spawn, execSync } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';

// Clean up any stale process on port 5173
function freePort5173() {
  try {
    if (process.platform === 'win32') {
      execSync('powershell -Command "Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"', { stdio: 'ignore' });
    }
  } catch (e) {
    // Ignore if no process was running
  }
}

function checkViteReady(url, maxAttempts = 40) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      http.get(url, (res) => {
        if (res.statusCode === 200 || res.statusCode === 304) {
          clearInterval(interval);
          resolve();
        }
      }).on('error', () => {
        if (attempts >= maxAttempts) {
          clearInterval(interval);
          reject(new Error('Vite dev server timed out waiting for connection.'));
        }
      });
    }, 250);
  });
}

async function main() {
  freePort5173();

  console.log('📦 Compilando processos do Electron (main/preload)...');
  execSync('npx tsc -p electron/tsconfig.json', { stdio: 'inherit' });

  // Ensure dist-electron/package.json has {"type": "commonjs"}
  const distElectronDir = path.resolve('dist-electron');
  if (!fs.existsSync(distElectronDir)) {
    fs.mkdirSync(distElectronDir, { recursive: true });
  }
  fs.writeFileSync(
    path.join(distElectronDir, 'package.json'),
    JSON.stringify({ type: 'commonjs' }, null, 2)
  );

  console.log('⚡ Iniciando Vite Dev Server...');
  const viteProcess = spawn('npx', ['vite', '--host', '127.0.0.1', '--port', '5173'], {
    shell: true,
    stdio: 'inherit',
  });

  try {
    console.log('⏳ Aguardando Vite conectar em http://127.0.0.1:5173...');
    await checkViteReady('http://127.0.0.1:5173');
    console.log('🚀 Vite conectado! Abrindo Electron...');

    const electronProcess = spawn('npx', ['electron', 'dist-electron/main.js'], {
      shell: true,
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_ENV: 'development',
      },
    });

    electronProcess.on('close', (code) => {
      console.log(`\nElectron finalizado (código: ${code})`);
      viteProcess.kill();
      freePort5173();
      process.exit(code || 0);
    });
  } catch (err) {
    console.error('Erro na inicialização:', err);
    viteProcess.kill();
    freePort5173();
    process.exit(1);
  }
}

main();

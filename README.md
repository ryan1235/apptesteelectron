# Discord Live Rooms - Voice & GPU Screen Share (Electron) 🎮⚡🎙️

Aplicativo desktop completo no estilo **Discord** construído em **Electron + React + TypeScript + Tailwind CSS** para **Chat de Voz de Baixa Latência** e **Compartilhamento de Tela 60 FPS com Aceleração GPU (WebCodecs)** através do protocolo binário de alta performance de 50 bytes (`0xAA`).

---

## 🌟 Funcionalidades Principais

1. **Protocolo Binário de 50 Bytes (`0xAA`)**:
   - `0x01`: Transmissão de Vídeo GPU WebCodecs (H.264/VP8 em 60 FPS)
   - `0x05`: Áudio de Microfone / Voice Chat (PCM 44.1kHz Int16)
   - `0x02`: Áudio do Compartilhamento de Tela (PCM Stereo)
   - `0x03` / `0x04`: Telemetria & Controle (~30ms latência)

2. **Prevenção Total de Loopback & Duplicação de Áudio**:
   - Quando você compartilha a tela inteira ou janelas com som do sistema, o áudio de quem está na chamada é separado e isolado.
   - **Zero Retorno Local**: Sua própria voz nunca é reproduzida no seu fone (sem eco pessoal).
   - **Cancelamento Acústico de Eco (AEC)**, **Supressão de Ruído** e **Controle Automático de Ganho (AGC)**.

3. **Interface Completa Estilo Discord (Dark Theme)**:
   - **Barra de Título Frameless**: Arraste nativo e botões minimizar/maximizar/fechar.
   - **Barra Lateral de Servidores & Canais**: Lista de salas ao vivo com contagem de membros em tempo real e cadeado 🔒 para salas privadas.
   - **Anéis de Voz Verdes Pulsantes (VAD)**: Detecção de atividade de voz instantânea.
   - **Telão de Transmissão GPU com Zoom Digital (1x a 3x)**: Arraste para navegar na tela ampliada, tela cheia e HUD de telemetria em tempo real (FPS, Bitrate, Latência e Codec).
   - **Chat Lateral em Tempo Real**: Histórico persistido e sincronização via WebSocket.
   - **Seletor Visual de Fontes**: Miniaturas em tempo real de telas e janelas abertas via Electron `desktopCapturer`.

4. **Integração com Rotas REST e WebSocket**:
   - `GET /live-rooms`, `POST /live-rooms`, `POST /live-rooms/:id/verify-password`, `GET /live-rooms/:id`, `DELETE /live-rooms/:id`.
   - WebSocket `/ws/live-room?token=<JWT_TOKEN>` com suporte multiplexado a JSON e pacotes binários ArrayBuffer.

---

## ⚙️ Configuração do `.env`

No arquivo `.env` na raiz do projeto:

```env
# URL base da API REST
VITE_API_URL=http://localhost:3333

# URL do WebSocket
VITE_WS_URL=ws://localhost:3333/ws/live-room

# Token JWT padrão (Bearer)
VITE_JWT_TOKEN=seu_jwt_token_aqui

# Nome e Avatar padrão do usuário
VITE_DEFAULT_USER_NAME=Ryan
VITE_DEFAULT_AVATAR_URL=

# Configurações de Áudio & Anti-Eco/Loopback
VITE_AUDIO_ECHO_CANCELLATION=true
VITE_AUDIO_NOISE_SUPPRESSION=true
VITE_AUDIO_AUTO_GAIN_CONTROL=true
VITE_SCREEN_AUDIO_LOOPBACK_PREVENTION=true
```

> **Dica**: Você também pode alterar essas variáveis e chave JWT em tempo de execução através do botão de **Configurações ⚙️** dentro do próprio aplicativo!

---

## 🚀 Como Executar

### 1. Instalar Dependências
```bash
npm install
```

### 2. Iniciar no Modo Desenvolvimento (Vite + Electron)
```bash
npm run electron:dev
```

### 3. Gerar Build de Produção
```bash
npm run electron:build
```

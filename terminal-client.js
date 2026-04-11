// terminal-client.js
const WebSocket = require('ws');
const readline = require('readline');
require('dotenv').config();

const SERVER_URL = process.env.TERMINAL_URL || 'ws://localhost:3000';
const TERMINAL_SECRET = process.env.TERMINAL_SECRET || 'y2k-terminal-secret-2024';

console.log(`🖥️ Conectando ao Y2K Terminal Server: ${SERVER_URL}`);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: '🔌 Conectando... '
});

let ws = null;

function connect() {
  ws = new WebSocket(SERVER_URL);
  
  ws.on('open', () => {
    console.log('✅ Conectado! Autenticando...');
    ws.send(JSON.stringify({
      type: 'auth',
      secret: TERMINAL_SECRET
    }));
  });
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      
      switch (message.type) {
        case 'auth_success':
          console.log('\n' + message.message);
          rl.setPrompt(message.prompt);
          rl.prompt();
          break;
          
        case 'response':
          console.log('\n' + message.message);
          rl.setPrompt(message.prompt);
          rl.prompt();
          break;
          
        case 'status':
          console.log('\n📊 Status atual:');
          console.log(`🌐 Site: ${message.data.online ? '🟢 ONLINE' : '🔴 OFFLINE'}`);
          console.log(`🔧 Manutenção: ${message.data.maintenanceMode ? '⚠️ ATIVADA' : '✅ DESATIVADA'}\n`);
          rl.prompt();
          break;
          
        case 'status_update':
          console.log('\n⚠️ Status do site foi alterado via terminal!');
          console.log(`🌐 Site: ${message.data.online ? '🟢 ONLINE' : '🔴 OFFLINE'}\n`);
          rl.prompt();
          break;
          
        case 'error':
          console.log('\n' + message.message);
          rl.prompt();
          break;
      }
    } catch (error) {
      console.log('\n📨 ' + data);
      rl.prompt();
    }
  });
  
  ws.on('close', () => {
    console.log('\n👋 Conexão encerrada. Até logo!');
    rl.close();
    process.exit(0);
  });
  
  ws.on('error', (error) => {
    console.log('\n❌ Erro na conexão:', error.message);
    console.log('💡 Verifique se o servidor está rodando.');
    process.exit(1);
  });
}

rl.on('line', (line) => {
  const input = line.trim();
  
  if (input === 'exit' || input === 'quit') {
    if (ws) ws.close();
    rl.close();
    return;
  }
  
  if (input === 'clear' || input === 'cls') {
    console.clear();
    rl.prompt();
    return;
  }
  
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'command', command: input }));
  } else {
    console.log('❌ Não conectado ao servidor');
    rl.prompt();
  }
});

rl.on('close', () => {
  if (ws) ws.close();
  process.exit(0);
});

connect();

console.log(`
╔══════════════════════════════════════════════════════════╗
║           🖥️  Y2K TERMINAL ADMINISTRATIVO  🖥️            ║
╠══════════════════════════════════════════════════════════╣
║  💡 Digite "help" para ver todos os comandos             ║
║  🔌 Aguardando conexão...                                ║
╚══════════════════════════════════════════════════════════╝
`);
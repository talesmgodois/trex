#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';

// No ESM, __dirname não existe nativamente, precisamos emular:
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const platform = os.platform();
const arch = os.arch();

let binaryName = 'trex-linux-x64';

if (platform === 'win32') {
  binaryName = 'trex-win-x64.exe';
} else if (platform === 'darwin') {
  // Ajuste para Mac Intel se necessário, caso contrário mantém arm64
  binaryName = arch === 'arm64' ? 'trex-macos-arm64' : 'trex-macos-x64'; 
} else {
  binaryName = 'trex-linux-x64';
}

// O caminho agora reflete a estrutura ./dist/artifacts/[nome]/[nome]
const binaryPath = path.resolve(__dirname, '..', 'dist', 'artifacts', binaryName, binaryName);

const child = spawn(binaryPath, process.argv.slice(2), {
  stdio: 'inherit',
  shell: platform === 'win32' // Necessário para Windows em alguns casos
});

child.on('error', (err) => {
  console.error(`❌ Erro ao iniciar o Trex: ${err.message}`);
  console.error(`Caminho tentado: ${binaryPath}`);
  process.exit(1);
});

child.on('exit', (code) => {
  process.exit(code || 0);
});
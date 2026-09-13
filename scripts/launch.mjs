import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
process.chdir(fileURLToPath(new URL('..', import.meta.url)));
const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 18)) {
  console.error(
    'Instale Node.js 22.18 ou mais recente para executar o ReqAudit.',
  );
  process.exit(1);
}
const run = (args) =>
  new Promise((resolve) => {
    const child = spawn(process.execPath, args, {
      stdio: 'inherit',
      windowsHide: true,
    });
    child.on('exit', resolve);
    child.on('error', (e) => {
      console.error(e.message);
      resolve(1);
    });
  });
if (!existsSync('node_modules/express')) {
  console.error('Execute npm install na pasta req-audit antes de iniciar.');
  process.exit(1);
}
await import('dotenv/config');
if (!existsSync('dist-local/index.html')) {
  const code = await run([
    'node_modules/vite/bin/vite.js',
    'build',
    '--config',
    'vite.local.ts',
  ]);
  if (code) process.exit(code);
}
const port = Number(process.env.PORT || 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('PORT deve ser um número entre 1 e 65535.');
  process.exit(1);
}
const url = `http://localhost:${port}/`;
try {
  const response = await fetch(url + 'api/health', {
    signal: AbortSignal.timeout(1500),
  });
  const health = await response.json();
  if (health.application === 'ReqAudit') {
    openBrowser();
    console.log('O ReqAudit já está em execução em ' + url);
    process.exit(0);
  }
} catch {}
const server = spawn(process.execPath, ['backend/server.js'], {
  stdio: 'inherit',
  windowsHide: true,
});
server.on('error', (error) => {
  console.error(error.message);
  process.exit(1);
});
server.on('exit', (code) => process.exit(code || 0));
process.on('SIGINT', () => server.kill());
process.on('SIGTERM', () => server.kill());
function openBrowser() {
  if (process.argv.includes('--no-browser')) return;
  if (process.platform === 'win32')
    spawn(
      'powershell.exe',
      ['-NoProfile', '-Command', `Start-Process '${url}'`],
      { stdio: 'ignore', windowsHide: true },
    );
  else if (process.platform === 'darwin')
    spawn('open', [url], { stdio: 'ignore' });
  else spawn('xdg-open', [url], { stdio: 'ignore' });
}
let ready = false;
for (let i = 0; i < 25; i++) {
  try {
    const response = await fetch(url + 'api/health', {
      signal: AbortSignal.timeout(1000),
    });
    const health = await response.json();
    if (health.application === 'ReqAudit') {
      ready = true;
      openBrowser();
      console.log(
        '\nMantenha esta janela aberta. Pressione Ctrl+C para encerrar.\n',
      );
      break;
    }
  } catch {}
  await new Promise((resolve) => setTimeout(resolve, 400));
}
if (!ready) {
  console.error('O servidor não iniciou. Confira a porta e os erros acima.');
  server.kill();
  process.exitCode = 1;
}

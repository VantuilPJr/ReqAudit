import { spawn } from 'node:child_process';
const children = [
  spawn(process.execPath, ['backend/server.js'], { stdio: 'inherit' }),
  spawn(
    process.execPath,
    ['node_modules/vite/bin/vite.js', '--config', 'vite.local.ts'],
    { stdio: 'inherit' },
  ),
];
let closing = false;
const close = () => {
  if (closing) return;
  closing = true;
  children.forEach((c) => c.kill());
};
process.on('SIGINT', close);
process.on('SIGTERM', close);
children.forEach((c) => {
  c.on('error', (e) => {
    console.error(e);
    close();
    process.exitCode = 1;
  });
  c.on('exit', (code) => {
    close();
    process.exitCode = code || 0;
  });
});

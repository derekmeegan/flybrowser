import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const child = spawn(process.execPath, [
  'packages/evals/dist/cli/cli.js', 'run', 'fly/fruit_market',
  '--env', 'local', '--tool', 'understudy_code', '--trials', '1', '--concurrency', '1',
  ...process.argv.slice(2),
], {
  cwd: root + '/vendor/stagehand',
  env: { ...process.env, FLY_LAB_ROOT: root },
  stdio: 'inherit',
});
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });

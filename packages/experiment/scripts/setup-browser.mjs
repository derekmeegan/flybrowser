// Fetch exact upstream commits and build the Stagehand extension and evals CLI.
import { readFile, mkdir, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const sources = JSON.parse(await readFile(new URL('../sources.json', import.meta.url), 'utf8'));
function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} exited ${result.status}`);
}
await mkdir(new URL('../vendor/', import.meta.url), { recursive: true });
for (const name of ['stagehand', 'flybody']) {
  const source = sources[name];
  const directory = fileURLToPath(new URL(`../vendor/${name}`, import.meta.url));
  let exists = true;
  try { await access(directory); } catch { exists = false; }
  if (!exists) {
    run('git', ['clone', '--filter=blob:none', '--no-checkout', source.repository, directory]);
    run('git', ['fetch', '--depth', '1', 'origin', source.commit], directory);
    run('git', ['checkout', '--detach', source.commit], directory);
  }
  const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: directory, encoding: 'utf8' });
  if (head.status !== 0 || head.stdout.trim() !== source.commit) {
    throw new Error(`${directory} must be at ${source.commit}. Move the existing checkout before rerunning setup.`);
  }
}
const pnpm = ['--dir', 'vendor/stagehand'];
run('pnpm', [...pnpm, 'install', '--frozen-lockfile']);
run('pnpm', [...pnpm, 'exec', 'turbo', 'build', '--filter=@browserbasehq/stagehand', '--filter=@browserbasehq/stagehand-extension']);
run(process.execPath, ['src/install_evals_task.mjs']);
run('pnpm', [...pnpm, 'exec', 'turbo', 'build', '--filter=@browserbasehq/stagehand-evals']);
console.log('Pinned Stagehand, extension, evals task and Flybody assets are ready.');

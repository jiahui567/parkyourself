// Stop hook: before Claude finishes, runs lint and tests if the code changed
// since the last passing check. On failure it asks Claude to keep working
// ("decision": "block"); it allows one fix round, then lets Claude stop.
const { spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// scripts/, supabase/ and plugins/ too: test/carParkSql.test.js, serverColumns.test.js,
// serverLimits.test.js and withNoDeviceTransfer.test.js read them.
const CODE_PATHS = [
  'src',
  'test',
  'scripts',
  'supabase',
  'plugins',
  'package.json',
  'package-lock.json',
  'jest.config.js',
  'eslint.config.js',
  'app.json',
];

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const sha1 = (text) => crypto.createHash('sha1').update(text).digest('hex');
const git = (args) => spawnSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

// A fingerprint of every uncommitted change to code, including new files.
function codeFingerprint() {
  const status = git(['status', '--porcelain', '-uall', '--', ...CODE_PATHS]);
  if (status.status !== 0) return null;
  if (status.stdout.trim() === '') return '';
  const diff = git(['diff', 'HEAD', '--', ...CODE_PATHS]).stdout ?? '';
  const untracked = status.stdout
    .split('\n')
    .filter((line) => line.startsWith('?? '))
    .map((line) => {
      const file = path.join(root, line.slice(3).replace(/^"|"$/g, ''));
      return fs.existsSync(file) ? sha1(fs.readFileSync(file)) : '';
    });
  return sha1(status.stdout + diff + untracked.join(''));
}

function run(label, command) {
  const result = spawnSync(command, { cwd: root, shell: true, encoding: 'utf8', env: { ...process.env, CI: '1' } });
  if (result.status === 0) return null;
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`
    .replace(/\u001b\[[0-9;]*m/g, '') // colour codes
    .split('\n')
    .filter((line) => !/ExperimentalWarning|--trace-warnings/.test(line))
    .slice(-40)
    .join('\n')
    .trim();
  return `${label} failed:\n${output}`;
}

let input = '';
process.stdin.on('data', (chunk) => (input += chunk));
process.stdin.on('end', () => {
  if (JSON.parse(input || '{}').stop_hook_active) process.exit(0);

  const fingerprint = codeFingerprint();
  if (!fingerprint) process.exit(0); // not a git repo, or no code changes

  const stamp = path.join(os.tmpdir(), `park-yourself-check-${sha1(root).slice(0, 12)}`);
  if (fs.existsSync(stamp) && fs.readFileSync(stamp, 'utf8') === fingerprint) process.exit(0);

  const failure = run('npm run lint', 'npm run lint -- --no-cache') ?? run('npm test', 'npm test -- --ci');
  if (failure) {
    process.stdout.write(JSON.stringify({ decision: 'block', reason: `${failure}\n\nFix this before finishing.` }));
    process.exit(0);
  }
  fs.writeFileSync(stamp, fingerprint);
  process.exit(0);
});

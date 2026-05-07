import { spawn } from 'node:child_process';
import { confirm } from '@inquirer/prompts';
import { bold, c } from './utils.mjs';

const PKG_NAME = '@southloopstudios/cf-pages-cleaner';
const NPM_LATEST_URL = `https://registry.npmjs.org/${PKG_NAME}/latest`;

/**
 * Self-update flow. Compares the installed version against the registry's
 * `latest` tag, then offers to run `npm install -g <pkg>@latest` for the user
 * with inherited stdio so they see the install output as it happens.
 */
export async function runUpdate({ currentVersion, isNpx }) {
  console.log(bold('cf-pages-cleaner update'));
  console.log();

  process.stdout.write(c.gray('  Checking the registry… '));
  let latest;
  try {
    const res = await fetch(NPM_LATEST_URL);
    if (!res.ok) throw new Error(`registry returned ${res.status}`);
    const data = await res.json();
    latest = data.version;
    process.stdout.write(c.green(`✓ latest is ${latest}\n`));
  } catch (err) {
    process.stdout.write(c.red(`✗ ${err.message}\n`));
    return 1;
  }

  console.log();
  console.log(`  Installed: ${c.cyan(currentVersion)}`);
  console.log(`  Latest:    ${c.cyan(latest)}`);
  console.log();

  const cmp = semverCompare(currentVersion, latest);
  if (cmp === 0) {
    console.log(c.green('Already on the latest version.'));
    return 0;
  }
  if (cmp > 0) {
    console.log(
      c.yellow(
        `Installed version is ahead of the registry. Probably a dev or pre-release\nbuild — nothing to upgrade.`,
      ),
    );
    return 0;
  }

  if (isNpx) {
    console.log(
      c.yellow(
        'You are running via npx, which already pulls the latest version on each\n' +
          'invocation. There is nothing to upgrade — just re-run the command.',
      ),
    );
    return 0;
  }

  const ok = await confirm({
    message: `Upgrade ${currentVersion} → ${latest}?`,
    default: true,
  });
  if (!ok) {
    console.log('Cancelled.');
    return 0;
  }

  console.log();
  console.log(c.gray(`  Running: npm install -g ${PKG_NAME}@latest`));
  console.log();

  const code = await runCommand('npm', ['install', '-g', `${PKG_NAME}@latest`]);
  console.log();
  if (code === 0) {
    console.log(c.green(`✓ Upgraded to ${latest}.`));
    console.log(c.gray('  Open a new terminal or re-run the command to use the new version.'));
    return 0;
  }
  console.log(
    c.red(`npm install failed (exit ${code}).`) +
      '\n  You can retry manually:\n  ' +
      bold(`npm install -g ${PKG_NAME}@latest`),
  );
  return code ?? 1;
}

function runCommand(cmd, args) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: 'inherit' });
    child.on('error', (err) => {
      console.log(c.red(`Failed to spawn ${cmd}: ${err.message}`));
      resolve(1);
    });
    child.on('exit', (code) => resolve(code ?? 1));
  });
}

// Numeric semver compare — sufficient for our x.y.z release scheme.
// Returns 1 if a > b, -1 if a < b, 0 if equal.
function semverCompare(a, b) {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) > (pb[i] ?? 0)) return 1;
    if ((pa[i] ?? 0) < (pb[i] ?? 0)) return -1;
  }
  return 0;
}

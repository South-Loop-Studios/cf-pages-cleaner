import { confirm, password, select } from '@inquirer/prompts';
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import open from 'open';
import { bold, c } from './utils.mjs';

const TOKEN_URL = 'https://dash.cloudflare.com/profile/api-tokens';
const CF_API = 'https://api.cloudflare.com/client/v4';
const RC_MARKER = '# cf-pages-cleaner';

/**
 * Guided first-run setup. Walks the user through creating a Cloudflare API
 * token, picking an account, and saving the pair somewhere the tool will
 * find them next time.
 */
export async function runSetup({ cwd } = {}) {
  cwd ??= process.cwd();

  console.log(bold('cf-pages-cleaner setup'));
  console.log();
  console.log('Three steps:');
  console.log('  1. Create a Cloudflare API token');
  console.log('  2. Pick the account that owns your Pages projects');
  console.log('  3. Save the credentials so future runs just work');
  console.log();

  // 1. token
  console.log(bold('Step 1 — API token'));
  console.log('Use the ' + c.cyan('"Cloudflare Pages — Edit"') + ' template. Scope it to');
  console.log('the account that owns the Pages projects you want to clean.');
  console.log();

  const openBrowser = await confirm({
    message: `Open ${c.cyan(TOKEN_URL)} in your browser?`,
    default: true,
  });
  if (openBrowser) {
    try {
      await open(TOKEN_URL);
    } catch {
      console.log(c.yellow('  (Could not auto-open — visit the URL above manually.)'));
    }
  }

  let token;
  let accounts;
  while (true) {
    token = (
      await password({
        message: 'Paste your API token:',
        mask: '*',
        validate: (v) => v.trim().length > 10 || 'That does not look like a token.',
      })
    ).trim();

    process.stdout.write(c.gray('  Validating… '));
    try {
      accounts = await listAccounts(token);
      process.stdout.write(c.green('✓ valid\n'));
      break;
    } catch (err) {
      process.stdout.write(c.red(`✗ ${err.message}\n`));
      const retry = await confirm({ message: 'Try a different token?', default: true });
      if (!retry) return 1;
    }
  }
  console.log();

  // 2. account
  console.log(bold('Step 2 — Account'));
  if (accounts.length === 0) {
    console.log(
      c.red('Token has no accessible accounts.') +
        '\nCheck the token\'s "Account Resources" scope.',
    );
    return 1;
  }
  let accountId;
  if (accounts.length === 1) {
    const only = accounts[0];
    console.log(`Using ${c.cyan(only.name)} ${c.gray('(' + only.id + ')')}.`);
    accountId = only.id;
  } else {
    accountId = await select({
      message: 'Which account?',
      choices: accounts.map((a) => ({
        name: `${a.name}  ${c.gray('(' + a.id + ')')}`,
        value: a.id,
      })),
    });
  }
  console.log();

  // 3. save
  console.log(bold('Step 3 — Save'));
  const choices = [
    {
      name: `Write a ${c.cyan('.env')} file in this directory (recommended)`,
      value: 'env',
    },
  ];
  const rcPath = detectShellRc();
  if (rcPath) {
    choices.push({ name: `Append to ${c.cyan(tildify(rcPath))} (loads in every shell)`, value: 'rc' });
  }
  choices.push({
    name: "Just print the export commands; I'll save them myself",
    value: 'print',
  });

  const where = await select({ message: 'Where should I save these?', choices });

  if (where === 'env') {
    const envPath = resolve(cwd, '.env');
    writeEnvFile(envPath, token, accountId);
    console.log(c.green(`✓ Wrote ${envPath}`) + c.gray(' (chmod 600)'));
    console.log(c.gray('  Run cf-pages-cleaner from this directory and it will auto-load.'));
  } else if (where === 'rc') {
    upsertShellRc(rcPath, token, accountId);
    console.log(c.green(`✓ Updated ${tildify(rcPath)}`));
    console.log(
      c.gray(`  Open a new terminal, or run \`source ${tildify(rcPath)}\`, to pick them up.`),
    );
  } else {
    console.log();
    console.log(c.cyan(`export CLOUDFLARE_API_TOKEN="${token}"`));
    console.log(c.cyan(`export CLOUDFLARE_ACCOUNT_ID="${accountId}"`));
  }

  console.log();
  console.log(c.green('Done.') + ' Next: ' + bold('cf-pages-cleaner'));
  return 0;
}

async function listAccounts(token) {
  let res;
  try {
    res = await fetch(`${CF_API}/accounts`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (err) {
    throw new Error(`Network error: ${err.message}`);
  }
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Non-JSON response (${res.status})`);
  }
  if (!res.ok || data.success === false) {
    throw new Error(data?.errors?.[0]?.message || `${res.status} ${res.statusText}`);
  }
  return (data.result ?? []).map((a) => ({ id: a.id, name: a.name }));
}

function detectShellRc() {
  const shell = process.env.SHELL || '';
  if (shell.endsWith('/zsh')) return resolve(homedir(), '.zshrc');
  if (shell.endsWith('/bash')) {
    const profile = resolve(homedir(), '.bash_profile');
    return existsSync(profile) ? profile : resolve(homedir(), '.bashrc');
  }
  return null;
}

function tildify(p) {
  const home = homedir();
  return p.startsWith(home) ? '~' + p.slice(home.length) : p;
}

/**
 * Replace any existing CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID lines in
 * the .env file (or create a fresh one) with the new pair. Leaves any other
 * keys untouched.
 */
function writeEnvFile(path, token, accountId) {
  let preserved = '';
  if (existsSync(path)) {
    preserved = readFileSync(path, 'utf8')
      .split('\n')
      .filter((l) => !/^\s*CLOUDFLARE_(API_TOKEN|ACCOUNT_ID)\s*=/.test(l))
      .join('\n');
    if (preserved && !preserved.endsWith('\n')) preserved += '\n';
  }
  const content =
    preserved + `CLOUDFLARE_API_TOKEN=${token}\nCLOUDFLARE_ACCOUNT_ID=${accountId}\n`;
  writeFileSync(path, content, { mode: 0o600 });
}

/**
 * Replace any existing `# cf-pages-cleaner` block in the rc file, or append a
 * new one. Lets users re-run setup without piling up duplicate exports.
 */
function upsertShellRc(path, token, accountId) {
  const block =
    `${RC_MARKER}\n` +
    `export CLOUDFLARE_API_TOKEN="${token}"\n` +
    `export CLOUDFLARE_ACCOUNT_ID="${accountId}"\n` +
    `# end cf-pages-cleaner\n`;

  if (!existsSync(path)) {
    writeFileSync(path, '\n' + block);
    return;
  }
  const original = readFileSync(path, 'utf8');
  const re = new RegExp(`${RC_MARKER}[\\s\\S]*?# end cf-pages-cleaner\\n?`, 'g');
  if (re.test(original)) {
    writeFileSync(path, original.replace(re, block));
  } else {
    appendFileSync(path, (original.endsWith('\n') ? '' : '\n') + '\n' + block);
  }
}

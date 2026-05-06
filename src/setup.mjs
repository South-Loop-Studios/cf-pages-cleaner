import { confirm, input, password, select } from '@inquirer/prompts';
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, resolve } from 'node:path';
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
  console.log('Open this URL in your browser:');
  console.log('  ' + c.cyan(TOKEN_URL));
  console.log();
  console.log('Click ' + bold('Create Token') + ' → ' + bold('Get started') + ' (custom token), then add:');
  console.log('  ' + c.bold('Permissions:') + '       Account → Cloudflare Pages → Edit');
  console.log('  ' + c.bold('Account Resources:') + ' Include → the account that owns your Pages projects');
  console.log('Click ' + bold('Continue to summary') + ' → ' + bold('Create Token') + ' and copy the token.');
  console.log();

  let token;
  while (true) {
    token = (
      await password({
        message: 'Paste your API token:',
        mask: '*',
        validate: (v) => v.trim().length > 10 || 'That does not look like a token.',
      })
    ).trim();

    process.stdout.write(c.gray('  Validating token… '));
    try {
      await verifyToken(token);
      process.stdout.write(c.green('✓ active\n'));
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
  // Try to enumerate accounts via /accounts. If the token doesn't have the
  // Account Settings: Read permission, this returns an empty list — which is
  // fine; we fall through to manual entry.
  let accounts = [];
  try {
    accounts = await listAccounts(token);
  } catch {
    // ignore — fall through to manual
  }

  let accountId;
  if (accounts.length === 1) {
    const only = accounts[0];
    console.log(`Using ${c.cyan(only.name)} ${c.gray('(' + only.id + ')')}.`);
    accountId = only.id;
  } else if (accounts.length > 1) {
    accountId = await select({
      message: 'Which account?',
      choices: accounts.map((a) => ({
        name: `${a.name}  ${c.gray('(' + a.id + ')')}`,
        value: a.id,
      })),
    });
  } else {
    // Manual fallback. The "Pages — Edit" permission alone doesn't grant
    // /accounts list access, so this is the common path for tokens scoped
    // tightly enough to be safe.
    console.log(
      "I can't list accounts from this token (it only has Pages permissions, which is fine — that\nis the safer scope). Paste your account ID instead:",
    );
    console.log(
      c.gray(
        '  Find it on https://dash.cloudflare.com — pick the account, then look at the URL:\n' +
          '  https://dash.cloudflare.com/' +
          c.cyan('<this-hex-string-is-your-account-id>') +
          '/...',
      ),
    );
    while (true) {
      const id = (
        await input({
          message: 'Account ID:',
          validate: (v) =>
            /^[a-f0-9]{32}$/.test(v.trim()) ||
            'That does not look like a Cloudflare account ID (32 hex chars).',
        })
      ).trim();

      process.stdout.write(c.gray('  Verifying access… '));
      try {
        await verifyAccountAccess(token, id);
        process.stdout.write(c.green('✓ ok\n'));
        accountId = id;
        break;
      } catch (err) {
        process.stdout.write(c.red(`✗ ${err.message}\n`));
        const retry = await confirm({
          message: 'Try a different account ID?',
          default: true,
        });
        if (!retry) return 1;
      }
    }
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

async function cfFetch(token, path) {
  let res;
  try {
    res = await fetch(`${CF_API}${path}`, {
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
  return data;
}

async function verifyToken(token) {
  const data = await cfFetch(token, '/user/tokens/verify');
  const status = data?.result?.status;
  if (status && status !== 'active') {
    throw new Error(`Token status: ${status}`);
  }
}

async function listAccounts(token) {
  const data = await cfFetch(token, '/accounts');
  return (data.result ?? []).map((a) => ({ id: a.id, name: a.name }));
}

// Confirm the token can read this account's Pages projects. This is the
// permission cf-pages-cleaner actually needs, so a 200 here is the most
// meaningful "this works" check.
async function verifyAccountAccess(token, accountId) {
  await cfFetch(token, `/accounts/${encodeURIComponent(accountId)}/pages/projects`);
}

function detectShellRc() {
  const base = basename(process.env.SHELL || '');
  if (base === 'zsh' || base.startsWith('zsh-')) return resolve(homedir(), '.zshrc');
  if (base === 'bash' || base.startsWith('bash-')) {
    const profile = resolve(homedir(), '.bash_profile');
    return existsSync(profile) ? profile : resolve(homedir(), '.bashrc');
  }
  return null;
}

// Escape a value for safe inclusion inside a double-quoted shell string or a
// double-quoted .env value. Covers backslash, double-quote, dollar (var
// expansion), and backtick (command substitution).
function escapeForDoubleQuoted(s) {
  return s.replace(/[\\"$`]/g, '\\$&');
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
  // Always quote values; dotenv strips the surrounding quotes when reading.
  // Escaping defends against tokens containing `"`, `\`, `$`, or backtick.
  const t = escapeForDoubleQuoted(token);
  const a = escapeForDoubleQuoted(accountId);
  const content =
    preserved + `CLOUDFLARE_API_TOKEN="${t}"\nCLOUDFLARE_ACCOUNT_ID="${a}"\n`;
  writeFileSync(path, content, { mode: 0o600 });
}

/**
 * Replace any existing `# cf-pages-cleaner` block in the rc file, or append a
 * new one. Lets users re-run setup without piling up duplicate exports.
 */
function upsertShellRc(path, token, accountId) {
  const t = escapeForDoubleQuoted(token);
  const a = escapeForDoubleQuoted(accountId);
  const block =
    `${RC_MARKER}\n` +
    `export CLOUDFLARE_API_TOKEN="${t}"\n` +
    `export CLOUDFLARE_ACCOUNT_ID="${a}"\n` +
    `# end cf-pages-cleaner\n`;

  if (!existsSync(path)) {
    writeFileSync(path, '\n' + block);
    return;
  }
  // Single replace + change-detection. Avoids the regex.test/replace
  // lastIndex footgun when the regex carries the `g` flag.
  const original = readFileSync(path, 'utf8');
  const re = new RegExp(`${RC_MARKER}[\\s\\S]*?# end cf-pages-cleaner\\n?`, 'g');
  const replaced = original.replace(re, block);
  if (replaced !== original) {
    writeFileSync(path, replaced);
  } else {
    appendFileSync(path, (original.endsWith('\n') ? '' : '\n') + '\n' + block);
  }
}

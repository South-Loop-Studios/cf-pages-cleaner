import { parseArgs } from 'node:util';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { CloudflareClient } from './api.mjs';
import { runTerminal } from './terminal.mjs';
import { runWeb } from './web.mjs';
import { c } from './utils.mjs';

const PKG = JSON.parse(
  readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '..', 'package.json'), 'utf8'),
);
const VERSION = PKG.version;

// `cf-pages-cleaner` if the user globally-installed; `npx <pkg>` if they're
// running ad-hoc via npx. npx caches binaries under ~/.npm/_npx/<hash>/...
// so a `/_npx/` segment in argv[1] is a reliable signal.
function invocationName() {
  const bin = process.argv[1] || '';
  return /[/\\]_npx[/\\]/.test(bin) ? `npx ${PKG.name}` : 'cf-pages-cleaner';
}

function helpText(inv) {
  return `cf-pages-cleaner — clean up old Cloudflare Pages deployments.

Usage:
  ${inv} [command] [options]

Commands:
  setup              Guided one-time setup for credentials. Recommended on first run.

Options:
  --project <name>   Skip the picker; jump straight into one project.
  --dry-run          Preview the kill list without calling DELETE.
  --web              Run the local browser GUI instead of the terminal UI.
  --host <addr>      Web UI bind host (default 127.0.0.1).
  --port <n>         Web UI port (default 8765).
  --no-open          Don't auto-open the browser when starting --web.
  -h, --help         Show this help.
  -v, --version      Print version and exit.

Auth (set in your shell, or in a .env file in the cwd):
  CLOUDFLARE_API_TOKEN   token with the "Pages — Edit" permission
  CLOUDFLARE_ACCOUNT_ID  account that owns the Pages project

Tip: \`${inv} setup\` walks you through creating both interactively.
`;
}

export async function main(argv) {
  // dotenv: load from cwd if a .env exists, but don't clobber real env vars.
  const envPath = resolve(process.cwd(), '.env');
  if (existsSync(envPath)) dotenv.config({ path: envPath, override: false });

  const { values, positionals } = parseArgs({
    args: argv,
    options: {
      project: { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
      web: { type: 'boolean', default: false },
      host: { type: 'string', default: '127.0.0.1' },
      port: { type: 'string', default: '8765' },
      'no-open': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
      version: { type: 'boolean', short: 'v', default: false },
    },
    allowPositionals: true,
  });

  const inv = invocationName();

  if (values.help) { process.stdout.write(helpText(inv)); return 0; }
  if (values.version) { process.stdout.write(VERSION + '\n'); return 0; }

  const cmd = positionals[0];
  if (cmd === 'setup') {
    const { runSetup } = await import('./setup.mjs');
    return await runSetup({ cwd: process.cwd() });
  }
  if (cmd) {
    process.stderr.write(`Unknown command: ${cmd}\nRun \`${inv} --help\`.\n`);
    return 2;
  }

  const token = process.env.CLOUDFLARE_API_TOKEN;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!token || !accountId) {
    process.stderr.write(
      c.red('Missing credentials.\n') +
      '\nFirst time? Run:\n' +
      '  ' + c.bold(`${inv} setup`) + '\n' +
      'and it will walk you through creating the token, picking the account, and saving them.\n' +
      '\nOr set them yourself before running:\n' +
      '  CLOUDFLARE_API_TOKEN   token with the "Pages — Edit" permission\n' +
      '                         (https://dash.cloudflare.com/profile/api-tokens)\n' +
      '  CLOUDFLARE_ACCOUNT_ID  account that owns the Pages project\n',
    );
    return 2;
  }

  const port = Number(values.port);
  if (!Number.isFinite(port) || port < 1 || port > 65535) {
    process.stderr.write(`Invalid --port: ${values.port}\n`);
    return 2;
  }

  const client = new CloudflareClient({ token, accountId });
  const args = {
    project: values.project,
    dryRun: values['dry-run'],
    host: values.host,
    port,
    noOpen: values['no-open'],
  };

  if (values.web) return await runWeb(client, args);
  return await runTerminal(client, args);
}

import { parseArgs } from 'node:util';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import dotenv from 'dotenv';
import { CloudflareClient } from './api.mjs';
import { runTerminal } from './terminal.mjs';
import { runWeb } from './web.mjs';
import { c } from './utils.mjs';

const HELP = `cf-pages-cleaner — clean up old Cloudflare Pages deployments.

Usage:
  cf-pages-cleaner [options]

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
`;

const VERSION = '0.1.0';

export async function main(argv) {
  // dotenv: load from cwd if a .env exists, but don't clobber real env vars.
  const envPath = resolve(process.cwd(), '.env');
  if (existsSync(envPath)) dotenv.config({ path: envPath, override: false });

  const { values } = parseArgs({
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
    allowPositionals: false,
  });

  if (values.help) { process.stdout.write(HELP); return 0; }
  if (values.version) { process.stdout.write(VERSION + '\n'); return 0; }

  const token = process.env.CLOUDFLARE_API_TOKEN;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!token || !accountId) {
    process.stderr.write(
      c.red('Missing credentials.\n') +
      'Set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID before running.\n' +
      '  Token:    https://dash.cloudflare.com/profile/api-tokens\n' +
      '            (use the "Cloudflare Pages — Edit" template)\n' +
      '  Account:  shown in the URL on https://dash.cloudflare.com\n' +
      'Or drop them into a `.env` file in this directory.\n',
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

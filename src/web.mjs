import http from 'node:http';
import { URL, fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import open from 'open';
import { fetchDeployments } from './api.mjs';
import { bold, c } from './utils.mjs';
import { FALLBACK_LOGO_SVG, webHtml } from './web-ui.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_VERSION = JSON.parse(
  readFileSync(resolve(__dirname, '..', 'package.json'), 'utf8'),
).version;
// Search order for a brand logo: cwd/assets, then the package's own assets/.
const LOGO_SEARCH_DIRS = [
  resolve(process.cwd(), 'assets'),
  resolve(__dirname, '..', 'assets'),
];
const LOGO_FILES = [
  { name: 'logo.svg', mime: 'image/svg+xml' },
  { name: 'logo.png', mime: 'image/png' },
  { name: 'logo.jpg', mime: 'image/jpeg' },
  { name: 'logo.jpeg', mime: 'image/jpeg' },
  { name: 'logo.webp', mime: 'image/webp' },
];

function findLogo() {
  for (const dir of LOGO_SEARCH_DIRS) {
    for (const f of LOGO_FILES) {
      const p = resolve(dir, f.name);
      if (existsSync(p)) return { path: p, mime: f.mime };
    }
  }
  return null;
}

/**
 * Run the local web GUI. Binds to 127.0.0.1 by default; rejects requests
 * with non-localhost Host headers as a defence-in-depth measure.
 */
export async function runWeb(client, args) {
  const host = args.host ?? '127.0.0.1';
  const port = args.port ?? 8765;

  const server = http.createServer(async (req, res) => {
    try {
      await handle(req, res, client);
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, resolve);
  });

  const url = `http://${host}:${port}`;
  console.log(`\n  cf-pages-cleaner web UI:  ${bold(url)}`);
  console.log(c.gray('  Ctrl-C to stop.\n'));

  if (!args.noOpen) {
    try { await open(url); } catch { /* ignore */ }
  }

  // Keep the process alive until the user kills it.
  await new Promise(() => {});
  return 0; // unreachable, but keeps types tidy
}

async function handle(req, res, client) {
  const url = new URL(req.url, 'http://x');

  // GET /
  if (req.method === 'GET' && url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(webHtml(PKG_VERSION));
    return;
  }

  // GET /assets/logo  — user-supplied brand asset, with SVG fallback
  if (req.method === 'GET' && url.pathname === '/assets/logo') {
    const found = findLogo();
    if (found) {
      res.writeHead(200, {
        'Content-Type': found.mime,
        'Cache-Control': 'public, max-age=300',
      });
      res.end(readFileSync(found.path));
    } else {
      res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
      res.end(FALLBACK_LOGO_SVG);
    }
    return;
  }


  // GET /api/projects
  if (req.method === 'GET' && url.pathname === '/api/projects') {
    try {
      const projects = await client.listProjects();
      sendJson(res, 200, { projects: projects.map((p) => p.name) });
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return;
  }

  // GET /api/deployments?project=...
  if (req.method === 'GET' && url.pathname === '/api/deployments') {
    const project = url.searchParams.get('project') ?? '';
    if (!project) {
      sendJson(res, 400, { error: 'missing project' });
      return;
    }
    try {
      const deployments = await fetchDeployments(client, project);
      // Strip the getter; spread to plain objects.
      sendJson(res, 200, {
        deployments: deployments.map((d) => ({
          id: d.id,
          shortId: d.shortId,
          url: d.url,
          environment: d.environment,
          branch: d.branch,
          createdOn: d.createdOn,
          aliases: d.aliases,
          isProduction: d.isProduction,
          isAliasHead: d.isAliasHead,
          protected: d.protected,
        })),
      });
    } catch (err) {
      sendJson(res, 500, { error: err.message });
    }
    return;
  }

  // POST /api/delete  — streams NDJSON, one event per deployment, so the
  // client can show progress as deletes happen instead of waiting for the
  // whole batch to finish.
  if (req.method === 'POST' && url.pathname === '/api/delete') {
    let body;
    try {
      body = await readJson(req);
    } catch (err) {
      sendJson(res, 400, { error: err.message });
      return;
    }
    const { project, ids, dryRun } = body || {};
    if (!project || !Array.isArray(ids) || ids.length === 0) {
      sendJson(res, 400, { error: 'project and ids required' });
      return;
    }

    // Re-fetch + recompute protection server-side; never trust the client.
    let deps;
    try {
      deps = await fetchDeployments(client, project);
    } catch (err) {
      sendJson(res, 500, { error: err.message });
      return;
    }
    const byId = new Map(deps.map((d) => [d.id, d]));

    res.writeHead(200, {
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });

    const writeEvent = (obj) => res.write(JSON.stringify(obj) + '\n');

    let okCount = 0;
    let failCount = 0;
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const d = byId.get(id);
      const base = {
        type: 'result',
        index: i + 1,
        total: ids.length,
        id,
        shortId: d?.shortId ?? id.slice(0, 8),
        url: d?.url ?? '',
      };

      if (!d) {
        writeEvent({ ...base, ok: false, error: 'not found' });
        failCount++;
        continue;
      }
      if (d.protected) {
        writeEvent({ ...base, ok: false, error: 'protected' });
        failCount++;
        continue;
      }
      if (dryRun) {
        writeEvent({ ...base, ok: true, dryRun: true });
        okCount++;
        continue;
      }
      try {
        await client.deleteDeployment(project, id);
        writeEvent({ ...base, ok: true });
        okCount++;
      } catch (err) {
        writeEvent({ ...base, ok: false, error: err.message });
        failCount++;
      }
      // tiny pause to be polite to the API (matches the terminal pacing)
      await new Promise((r) => setTimeout(r, 100));
    }

    writeEvent({ type: 'done', ok: okCount, failed: failCount, dryRun: !!dryRun });
    res.end();
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('not found');
}

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', (c) => {
      total += c.length;
      if (total > 1_000_000) {
        reject(new Error('payload too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8');
      try {
        resolve(text ? JSON.parse(text) : {});
      } catch {
        reject(new Error('invalid json'));
      }
    });
    req.on('error', reject);
  });
}

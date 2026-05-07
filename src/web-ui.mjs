/* eslint-disable */
/**
 * The web UI is a single self-contained HTML document, served at "/" by the
 * local server. It uses the South Loop Studios palette: near-black background,
 * vibrant violet accent.
 *
 * Exposed as a function of `version` so the displayed CLI version always tracks
 * package.json — no hardcoded drift.
 *
 * The logo is fetched from `/assets/logo` (the server falls back to an inline
 * SVG placeholder if no logo file is found on disk).
 */
export const webHtml = (version) => String.raw`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>cf-pages-cleaner — South Loop Studios</title>
<style>
  :root {
    color-scheme: dark;
    --bg: #0a0612;
    --bg-elev: #150e24;
    --bg-row: rgba(155, 108, 255, 0.05);
    --line: rgba(155, 108, 255, 0.18);
    --text: #f3eefb;
    --muted: #9089a3;
    --accent: #9b6cff;
    --accent-hi: #b08eff;
    --accent-lo: #6e3fd6;
    --warn: #ffb547;
    --ok: #4ade80;
    --err: #ff6b6b;
  }
  * { box-sizing: border-box; }
  html, body { background: var(--bg); color: var(--text); }
  body {
    font: 14px/1.5 "Inter", ui-sans-serif, system-ui, -apple-system, sans-serif;
    margin: 0;
    min-height: 100vh;
    background:
      radial-gradient(60% 80% at 80% -10%, rgba(155, 108, 255, 0.18), transparent 60%),
      radial-gradient(50% 60% at -10% 0%, rgba(110, 63, 214, 0.14), transparent 60%),
      var(--bg);
  }

  /* ------------- header / brand ------------- */
  header.brand {
    display: flex; align-items: center; gap: 14px;
    padding: 18px 32px;
    border-bottom: 1px solid var(--line);
    backdrop-filter: blur(8px);
    position: sticky; top: 0; z-index: 5;
    background: rgba(10, 6, 18, 0.7);
  }
  /* Left: app name + version */
  header.brand .product {
    font-size: 12px; color: var(--muted);
    text-transform: uppercase; letter-spacing: 0.12em;
  }
  header.brand .product strong { color: var(--accent-hi); font-weight: 600; }
  /* Right: brand mark + wordmark, pushed by margin-left:auto */
  header.brand .brand-right {
    margin-left: auto;
    display: flex; align-items: center; gap: 12px;
  }
  header.brand .logo {
    width: 36px; height: 36px;
    display: grid; place-items: center;
  }
  header.brand .logo img,
  header.brand .logo svg { width: 100%; height: 100%; display: block; }
  header.brand .wordmark {
    display: flex; flex-direction: column; line-height: 1.1;
    text-align: right;
  }
  header.brand .wordmark .name {
    font-weight: 600; font-size: 15px; letter-spacing: 0.01em; color: var(--text);
  }
  header.brand .wordmark .sub {
    font-size: 11px; color: var(--muted); margin-bottom: 2px;
    text-transform: uppercase; letter-spacing: 0.12em;
  }

  /* ------------- main shell ------------- */
  main {
    max-width: 1200px; margin: 0 auto; padding: 28px 32px 80px;
  }
  h1 {
    font-size: 26px; font-weight: 700; margin: 0 0 6px;
    letter-spacing: -0.01em;
  }
  h1 .accent { color: var(--accent); }
  .sub { color: var(--muted); margin: 0 0 22px; font-size: 14px; }

  /* ------------- toolbar ------------- */
  .row {
    display: flex; gap: 12px; align-items: center;
    margin-bottom: 16px; flex-wrap: wrap;
  }
  label.field {
    display: inline-flex; align-items: center; gap: 8px;
    font-size: 13px; color: var(--muted);
  }
  select, button {
    font: inherit; padding: 8px 12px; border-radius: 8px;
    border: 1px solid var(--line); background: var(--bg-elev);
    color: var(--text); transition: border-color .15s, background .15s;
  }
  select { min-width: 200px; }
  select:hover, button:hover { border-color: var(--accent); }
  button { cursor: pointer; }
  button.primary {
    background: var(--accent); color: #0b0617;
    border-color: var(--accent); font-weight: 600;
  }
  button.primary:hover { background: var(--accent-hi); border-color: var(--accent-hi); }
  button.primary:disabled {
    opacity: .35; cursor: not-allowed;
    background: var(--bg-elev); color: var(--muted); border-color: var(--line);
  }
  .toolbar-right { margin-left: auto; display: flex; gap: 10px; align-items: center; }
  #summary { font-size: 13px; color: var(--muted); }
  .checkbox-label {
    display: inline-flex; align-items: center; gap: 6px;
    font-size: 13px; color: var(--muted); user-select: none;
  }

  /* ------------- table ------------- */
  .grid-wrap {
    border: 1px solid var(--line); border-radius: 12px;
    overflow: hidden; background: rgba(21, 14, 36, 0.5);
  }
  table { width: 100%; border-collapse: collapse; }
  th, td {
    padding: 10px 14px; text-align: left;
    border-bottom: 1px solid var(--line); vertical-align: middle;
  }
  thead th {
    font-weight: 600; font-size: 11px; text-transform: uppercase;
    letter-spacing: 0.08em; color: var(--muted);
    background: rgba(155, 108, 255, 0.06);
  }
  tbody tr:last-child td { border-bottom: none; }
  tbody tr.protected td { opacity: .45; }
  tbody tr:hover:not(.protected) { background: var(--bg-row); }
  td code {
    font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, monospace;
    font-size: 12px; color: var(--accent-hi);
  }
  td .url {
    max-width: 380px; overflow: hidden; text-overflow: ellipsis;
    white-space: nowrap; display: inline-block; vertical-align: bottom;
    color: var(--text); text-decoration: none; border-bottom: 1px dashed var(--line);
  }
  td .url:hover { border-bottom-color: var(--accent); color: var(--accent-hi); }
  .tag {
    display: inline-block; font-size: 10px; padding: 3px 8px; border-radius: 999px;
    font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em;
  }
  .tag.prod  { background: var(--accent); color: #0b0617; }
  .tag.alias { background: rgba(255, 181, 71, 0.18); color: var(--warn); border: 1px solid rgba(255, 181, 71, 0.4); }

  input[type="checkbox"] {
    accent-color: var(--accent);
    width: 16px; height: 16px; cursor: pointer;
  }
  input[type="checkbox"]:disabled { cursor: not-allowed; }

  /* ------------- log ------------- */
  #log {
    white-space: pre-wrap; font-family: "JetBrains Mono", ui-monospace, monospace;
    font-size: 12px; margin-top: 18px; padding: 14px;
    background: rgba(21, 14, 36, 0.6); border: 1px solid var(--line);
    border-radius: 12px; max-height: 240px; overflow: auto;
  }
  #log .err { color: var(--err); }
  #log .ok  { color: var(--ok); }

  /* ------------- footer ------------- */
  footer {
    max-width: 1200px; margin: 40px auto 0; padding: 18px 32px 28px;
    color: var(--muted); font-size: 12px;
    border-top: 1px solid var(--line);
    display: flex; gap: 16px; align-items: center; flex-wrap: wrap;
  }
  footer .dot { width: 4px; height: 4px; background: var(--accent); border-radius: 50%; }
  footer a { color: var(--muted); text-decoration: none; border-bottom: 1px dashed transparent; }
  footer a:hover { color: var(--accent-hi); border-bottom-color: var(--accent); }
</style>
</head>
<body>

<header class="brand">
  <div class="product">cf-pages-cleaner <strong>v${version}</strong></div>
  <div class="brand-right">
    <div class="wordmark">
      <span class="sub">Maintained by</span>
      <span class="name">South Loop Studios</span>
    </div>
    <div class="logo">
      <img src="/assets/logo" alt="South Loop Studios" onerror="this.style.display='none'">
    </div>
  </div>
</header>

<main>
  <h1>Cloudflare Pages <span class="accent">cleanup</span></h1>
  <p class="sub">Tick deployments to delete. Production and branch-alias heads are protected on both client and server.</p>

  <div class="row">
    <label class="field">Project
      <select id="project"></select>
    </label>
    <button id="reload">Reload</button>
    <span id="summary"></span>
    <div class="toolbar-right">
      <label class="checkbox-label"><input type="checkbox" id="dryrun"> dry-run</label>
      <button id="selectOld">Select &gt; 30 days</button>
      <button class="primary" id="deleteBtn" disabled>Delete selected</button>
    </div>
  </div>

  <div class="grid-wrap">
    <table id="grid">
      <thead>
        <tr>
          <th style="width:40px;"><input type="checkbox" id="checkAll"></th>
          <th>ID</th>
          <th>Branch</th>
          <th>Env</th>
          <th>Created</th>
          <th>URL</th>
          <th></th>
        </tr>
      </thead>
      <tbody></tbody>
    </table>
  </div>

  <div id="log" hidden></div>
</main>

<footer>
  <span>© South Loop Studios</span>
  <span class="dot"></span>
  <span>Creative technology consultancy</span>
  <span class="dot"></span>
  <a href="https://developers.cloudflare.com/pages/" target="_blank" rel="noopener">Cloudflare Pages docs</a>
</footer>

<script>
const $ = (s) => document.querySelector(s);
const tbody = document.querySelector('#grid tbody');
const state = { project: null, deployments: [] };

async function jget(url)        { const r = await fetch(url); return r.json(); }
async function jpost(url, body) {
  const r = await fetch(url, {
    method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(body || {})
  });
  return r.json();
}

function fmtAge(iso) {
  const d = new Date(iso); const ms = Date.now() - d.getTime();
  const days = Math.floor(ms / 86400000);
  if (days <= 0) return Math.max(1, Math.floor(ms/3600000)) + 'h ago';
  if (days < 30) return days + 'd ago';
  if (days < 365) return Math.floor(days/30) + 'mo ago';
  return Math.floor(days/365) + 'y ago';
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function render() {
  tbody.innerHTML = '';
  const protectedCount = state.deployments.filter(d => d.protected).length;
  $('#summary').textContent =
    state.deployments.length + ' deployments · ' + protectedCount + ' protected';

  if (state.deployments.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="color:var(--muted); padding:24px; text-align:center;">No deployments.</td></tr>';
    updateDeleteBtn(); return;
  }

  for (const d of state.deployments) {
    const tr = document.createElement('tr');
    if (d.protected) tr.classList.add('protected');
    const tag = d.isProduction
      ? '<span class="tag prod">PROD</span>'
      : d.isAliasHead ? '<span class="tag alias">ALIAS</span>' : '';
    const url = d.url ? '<a class="url" href="' + escapeHtml(d.url) +
                          '" target="_blank" rel="noopener">' +
                          escapeHtml(d.url) + '</a>' : '';

    tr.innerHTML =
      '<td><input type="checkbox" class="pick" data-id="' + escapeHtml(d.id) + '"' +
        (d.protected ? ' disabled' : '') + '></td>' +
      '<td><code>' + escapeHtml(d.shortId) + '</code></td>' +
      '<td>' + escapeHtml(d.branch || '—') + '</td>' +
      '<td>' + escapeHtml(d.environment) + '</td>' +
      '<td title="' + escapeHtml(d.createdOn) + '">' +
        escapeHtml(fmtAge(d.createdOn)) + '</td>' +
      '<td>' + url + '</td>' +
      '<td>' + tag + '</td>';
    tbody.appendChild(tr);
  }
  updateDeleteBtn();
}

function selectedIds() {
  return [...document.querySelectorAll('.pick:checked')].map(c => c.dataset.id);
}

function updateDeleteBtn() {
  const n = selectedIds().length;
  const btn = $('#deleteBtn');
  btn.disabled = n === 0;
  btn.textContent = n ? ('Delete ' + n + ' selected') : 'Delete selected';
}

async function loadProjects() {
  const data = await jget('/api/projects');
  if (data.error) {
    tbody.innerHTML = '<tr><td colspan="7" style="color:var(--err); padding:18px;">' +
      escapeHtml(data.error) + '</td></tr>';
    return;
  }
  const sel = $('#project');
  sel.innerHTML = '';
  for (const name of data.projects) {
    const opt = document.createElement('option');
    opt.value = opt.textContent = name;
    sel.appendChild(opt);
  }
  if (data.projects.length) await loadDeployments(data.projects[0]);
}

async function loadDeployments(project) {
  state.project = project;
  tbody.innerHTML = '<tr><td colspan="7" style="color:var(--muted); padding:18px;">Loading…</td></tr>';
  const data = await jget('/api/deployments?project=' + encodeURIComponent(project));
  if (data.error) {
    tbody.innerHTML = '<tr><td colspan="7" style="color:var(--err); padding:18px;">' +
      escapeHtml(data.error) + '</td></tr>';
    return;
  }
  state.deployments = data.deployments;
  render();
}

function appendLog(line, cls) {
  const log = $('#log');
  log.hidden = false;
  const span = document.createElement('div');
  if (cls) span.className = cls;
  span.textContent = line;
  log.appendChild(span);
  log.scrollTop = log.scrollHeight;
}

async function deleteSelected() {
  const ids = selectedIds();
  if (!ids.length) return;
  const dry = $('#dryrun').checked;
  const verb = dry ? 'Pretend-delete' : 'Delete';
  if (!confirm(verb + ' ' + ids.length + ' deployment(s) from "' +
      state.project + '"?')) return;

  $('#deleteBtn').disabled = true;
  appendLog(verb + ' ' + ids.length + ' deployment(s)…');

  // The server streams NDJSON: one JSON object per line as each delete
  // completes, then a final {type:'done', ok, failed} summary. Read the
  // body progressively so we can render results as they arrive.
  let res;
  try {
    res = await fetch('/api/delete', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ project: state.project, ids, dryRun: dry }),
    });
  } catch (err) {
    appendLog('Network error: ' + err.message, 'err');
    updateDeleteBtn(); return;
  }

  // Non-streaming error path: the server uses sendJson() (single-shot JSON)
  // for 4xx/5xx, not NDJSON. Detect that and bail out with the message.
  const ct = res.headers.get('content-type') || '';
  if (!ct.startsWith('application/x-ndjson')) {
    let payload;
    try { payload = await res.json(); } catch { payload = { error: 'unexpected response' }; }
    appendLog('  ✗ ' + (payload.error || ('HTTP ' + res.status)), 'err');
    updateDeleteBtn(); return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let summary = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl;
    while ((nl = buf.indexOf('\n')) !== -1) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      let ev;
      try { ev = JSON.parse(line); } catch { continue; }
      if (ev.type === 'done') {
        summary = ev;
      } else {
        // result event
        const tail = ev.url ? '  ' + ev.url : '';
        const dryTag = ev.dryRun ? ' (dry-run)' : '';
        const prefix = '  [' + ev.index + '/' + ev.total + '] ';
        if (ev.ok) appendLog(prefix + '✓ ' + ev.shortId + tail + dryTag, 'ok');
        else      appendLog(prefix + '✗ ' + ev.shortId + ': ' + ev.error, 'err');
      }
    }
  }

  if (summary) {
    const verbDone = summary.dryRun ? 'Pretend-delete' : 'Delete';
    const ok = summary.ok ?? 0;
    const failed = summary.failed ?? 0;
    appendLog(
      verbDone + ' complete · ' + ok + ' ok' + (failed ? ' · ' + failed + ' failed' : ''),
      failed ? 'err' : 'ok',
    );
  }

  if (!dry) await loadDeployments(state.project);
  updateDeleteBtn();
}

$('#project').addEventListener('change', e => loadDeployments(e.target.value));
$('#reload').addEventListener('click', () => state.project && loadDeployments(state.project));
$('#checkAll').addEventListener('change', e => {
  document.querySelectorAll('.pick:not(:disabled)').forEach(c => c.checked = e.target.checked);
  updateDeleteBtn();
});
tbody.addEventListener('change', e => {
  if (e.target.classList.contains('pick')) updateDeleteBtn();
});
$('#selectOld').addEventListener('click', () => {
  const cutoff = Date.now() - 30*86400000;
  document.querySelectorAll('.pick:not(:disabled)').forEach(c => {
    const d = state.deployments.find(x => x.id === c.dataset.id);
    if (d && new Date(d.createdOn).getTime() < cutoff) c.checked = true;
  });
  updateDeleteBtn();
});
$('#deleteBtn').addEventListener('click', deleteSelected);

loadProjects();
</script>
</body></html>
`;

/**
 * Inline-SVG fallback served at /assets/logo when no logo file is on disk.
 * Designed to roughly echo the South Loop Studios mark — a violet looping
 * triangular monogram on a transparent background. Replace `assets/logo.svg`
 * with the real brand asset and this fallback won't be used.
 */
export const FALLBACK_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#b08eff"/>
      <stop offset="1" stop-color="#6e3fd6"/>
    </linearGradient>
  </defs>
  <path d="M32 6 L58 50 H6 Z" stroke="url(#g)" stroke-width="4" stroke-linejoin="round"/>
  <circle cx="32" cy="36" r="8" stroke="url(#g)" stroke-width="4"/>
</svg>`;

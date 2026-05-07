<p align="center">
  <img src="assets/logo.png" alt="South Loop Studios" width="140" />
</p>

<h1 align="center">cf-pages-cleaner</h1>

<p align="center">
  <em>Sweep out old <strong>Cloudflare Pages</strong> deployments — terminal or local web GUI — without nuking anything that's actually serving traffic.</em>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@southloopstudios/cf-pages-cleaner"><img alt="npm version" src="https://img.shields.io/npm/v/@southloopstudios/cf-pages-cleaner?color=9b6cff&label=npm&style=flat-square" /></a>
  <a href="https://www.npmjs.com/package/@southloopstudios/cf-pages-cleaner"><img alt="downloads" src="https://img.shields.io/npm/dm/@southloopstudios/cf-pages-cleaner?color=6e3fd6&style=flat-square" /></a>
  <a href="./LICENSE"><img alt="license" src="https://img.shields.io/npm/l/@southloopstudios/cf-pages-cleaner?color=393244&style=flat-square" /></a>
  <img alt="node" src="https://img.shields.io/node/v/@southloopstudios/cf-pages-cleaner?color=393244&style=flat-square" />
  <a href="https://github.com/South-Loop-Studios/cf-pages-cleaner"><img alt="GitHub" src="https://img.shields.io/github/stars/South-Loop-Studios/cf-pages-cleaner?color=393244&style=flat-square" /></a>
</p>

<p align="center">
  Maintained by <a href="https://southloopstudios.com"><strong>South Loop Studios</strong></a>
</p>

---

Cloudflare's dashboard makes you delete deployments one click at a time, and
`wrangler` doesn't have a bulk-cleanup command. **cf-pages-cleaner** lists every
deployment for a project, marks the live ones as protected, and lets you tick
the rest for deletion — from the terminal or a tiny localhost web GUI.

```
Project: my-marketing-site
312 deployments · 5 protected

Protected (not selectable):
  3a9f2c4e  main                       4d ago  https://3a9f....pages.dev  PROD ALIAS
  ce14b7a1  feature/checkout-redesign  1d ago  https://ce14....pages.dev  ALIAS
  …

? Tick deployments to delete (space toggles, a toggles all, enter confirms):
 ❯ ◯ 1f2c8a90  feature/checkout-redesign  18d ago  https://1f2c....pages.dev
   ◯ 49ab771e  feature/checkout-redesign  21d ago  https://49ab....pages.dev
   ◉ 8b7d22ce  hotfix/og-image            2mo ago  https://8b7d....pages.dev
   …
```

#### What those tags mean

| Tag | Meaning |
|-----|---------|
| **`PROD`** | The **canonical production deployment** — the one currently serving your site's main URL (e.g. `your-site.pages.dev` or your custom domain). |
| **`ALIAS`** | The **head** (most recent deployment) of a branch. Cloudflare Pages gives each branch a stable preview subdomain like `feature-x.your-site.pages.dev` that always resolves to whichever deployment is currently the head of that branch. Delete the head and the alias URL breaks. |

Both are flagged **PROTECTED** in the UI and can't be selected for deletion. See [Protection rules](#protection-rules) for how this is enforced (server-side too) and how to free a head for deletion if you really need to.

<p align="center">
  <a href="#quick-start">Quick start</a> ·
  <a href="#features">Features</a> ·
  <a href="#setup">Setup</a> ·
  <a href="#usage">Usage</a> ·
  <a href="#protection-rules">Protection rules</a> ·
  <a href="#troubleshooting">Troubleshooting</a> ·
  <a href="#faq">FAQ</a>
</p>

---

## Quick start

```bash
# zero install — runs the latest published version
npx @southloopstudios/cf-pages-cleaner setup

# or install it globally
npm install -g @southloopstudios/cf-pages-cleaner
cf-pages-cleaner setup
```

`setup` walks you through creating a Cloudflare API token, picking an
account, and saving the credentials to either a `.env` file or your
shell rc. After that, just run:

```bash
cf-pages-cleaner               # interactive terminal
cf-pages-cleaner --web         # local browser GUI on http://127.0.0.1:8765
cf-pages-cleaner --dry-run     # preview the kill list, no delete
cf-pages-cleaner --project my-site  # skip the project picker
```

Prefer setting the env vars yourself? Skip `setup` and see [Manual setup](#setup)
below.

`cf-pages-cleaner --help` prints all flags.

### Updating

```bash
cf-pages-cleaner update
```

Checks the npm registry, shows the installed version against the latest, and
runs `npm install -g` for you on confirm. Detects `npx` invocations
(nothing to update — npx already pulls latest each run) and version-ahead
local builds.

---

## Features

<table>
<tr>
<td valign="top" width="50%">

### Two UIs in one binary
Terminal by default, `--web` flips on a tiny local browser GUI styled in the
South Loop Studios palette. Same logic, same protection rules.

### Knows what's live
The current production deployment and the head of every branch alias are
marked **PROTECTED** and cannot be selected — in either UI.

### Safe by default
Final `y/N` prompt before any DELETE, plus `--dry-run` for a no-op preview.
The web server re-checks protection on every delete request, so a tampered
client can't bypass it.

</td>
<td valign="top" width="50%">

### Real-time progress
The web UI streams per-deployment events as each delete resolves —
`[i/total] ✓ shortId  url` lines as they happen, instead of a frozen UI
while a 50-item batch churns.

### Guided setup
`cf-pages-cleaner setup` walks you through token creation, account
selection, and saving the credentials to either `.env` or your shell rc.
Re-run safely; existing entries get replaced cleanly.

### Self-updating
`cf-pages-cleaner update` checks the npm registry, shows installed-vs-latest,
and runs `npm install -g <pkg>@latest` for you on confirm.

</td>
</tr>
</table>

---

## Setup

> **Tip.** Run `cf-pages-cleaner setup` to do all of this interactively —
> the rest of this section is the manual version, useful if you want to
> script the credentials or already have them.

### 1. Get a Cloudflare API token

1. Open <https://dash.cloudflare.com/profile/api-tokens>.
2. Click **Create Token** → **Get started** (custom token).
3. Under **Permissions**, add:
   - **Account** → **Cloudflare Pages** → **Edit**
4. Under **Account Resources**, choose **Include** → the account that owns the
   Pages projects you want to clean.
5. (Optional) Set a TTL so the token auto-expires.
6. **Continue to summary** → **Create Token**, then copy it (it's shown once).

That permission set is exactly enough to list and delete deployments. Don't
use a Global API Key — that's wildly over-privileged for this.

### 2. Find your account ID

It's the long hex string in the dashboard URL after you pick an account:

```
https://dash.cloudflare.com/abcd1234deadbeefcafef00d1234abcd/...
                            └────────── account ID ──────────┘
```

Or, with the token already exported:

```bash
curl -sH "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  https://api.cloudflare.com/client/v4/accounts | jq '.result[].id'
```

### 3. Make the credentials available

Pick whichever style fits your workflow:

**a. Shell rc (permanent)** — drop into `~/.zshrc` (macOS default) or `~/.bashrc`:

```bash
export CLOUDFLARE_API_TOKEN="cf_xxx..."
export CLOUDFLARE_ACCOUNT_ID="abcd1234..."
```

Reload with `source ~/.zshrc`.

**b. Per-project `.env` file** — drop a `.env` next to wherever you run the
tool. `cf-pages-cleaner` auto-loads it from the cwd:

```dotenv
CLOUDFLARE_API_TOKEN=cf_xxx...
CLOUDFLARE_ACCOUNT_ID=abcd1234...
```

(Real env vars take precedence, so you can override per-invocation.)

**c. One shot** — inline for a single invocation:

```bash
CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... npx @southloopstudios/cf-pages-cleaner
```

---

## Usage

### Terminal

```bash
cf-pages-cleaner
```

Project picker → loads deployments → checkbox list (space toggles, `a`
toggles all, enter confirms) → preview the kill list → `y/N` → deletes.

| Flag                | What it does                                            |
|---------------------|----------------------------------------------------------|
| `--project NAME`    | Skip the picker; jump straight into one project.         |
| `--dry-run`         | Show the kill list, but don't actually call DELETE.      |

### Web GUI

```bash
cf-pages-cleaner --web
```

Opens <http://127.0.0.1:8765>. You get the South Loop Studios-branded UI
with:

- A project dropdown populated from the API
- A table with checkboxes; protected rows are dimmed and disabled
- A **"Select > 30 days"** shortcut
- A **dry-run** toggle in the toolbar
- A live log pane streaming per-deployment success / failure

The server only binds to **127.0.0.1**, so nothing else on your network
can hit it. Override with `--host` / `--port` if you really need to.

| Flag                | What it does                                            |
|---------------------|----------------------------------------------------------|
| `--host ADDR`       | Bind host (default `127.0.0.1`).                         |
| `--port N`          | Port (default `8765`).                                   |
| `--no-open`         | Don't auto-open the browser. Useful over SSH forwards.   |

### Branding the web UI

The header looks for a logo file under `assets/` (relative to the cwd, or
the package's own `assets/` folder if you've cloned the repo). Drop one of
these in:

```
assets/logo.svg     ← preferred
assets/logo.png
assets/logo.jpg
assets/logo.webp
```

If no file is found, a violet fallback SVG is served instead. Brand colours
are CSS custom properties at the top of `src/web-ui.mjs` — tweak them to
re-skin without touching anything else.

---

## Protection rules

The tool refuses to delete:

1. The **canonical (production) deployment** for the project — the one
   currently serving the main URL.
2. The **head of any branch.** Pages exposes a stable preview URL per branch
   (e.g. `feature-x.your-site.pages.dev`); the most recent deployment on
   each branch is the one currently aliased to that URL. Deleting it would
   break the alias.

Both rules are enforced **client-side** (rows disabled / not in the
checkbox list) **and** **server-side** in the web UI (a fresh API fetch
recomputes protection before any DELETE call). There is no flag to disable
this.

If you really need to remove an alias head: redeploy the branch first, then
come back — the new deployment inherits the alias and the old one becomes
deletable.

---

## Recipes

**Big sweep on one project**

```bash
cf-pages-cleaner --project my-site
# tick a, deselect last few, enter, y
```

**Preview without committing**

```bash
cf-pages-cleaner --project my-site --dry-run
```

**Web UI over an SSH tunnel**

```bash
ssh -L 8765:127.0.0.1:8765 my-server
# on the server:
cf-pages-cleaner --web --no-open
```

---

## Troubleshooting

**`Cloudflare API: Authentication error`**
Token wrong or expired. Create a fresh one with the *Account → Cloudflare
Pages → Edit* permission.

**`Cloudflare API: Authorization error`**
Token is fine but doesn't have access to *this* account. Check the
**Account Resources** scope.

**`Project 'foo' not found in this account.`**
The account ID and token don't match. Confirm with:

```bash
curl -sH "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/pages/projects \
  | jq '.result[].name'
```

**`Missing credentials.`**
Either env vars aren't exported in the shell that runs the tool, or your
`.env` file is in the wrong directory. Run from the same folder as the
`.env`, or use the rc-file approach in *Setup → 3a*.

**Browser opens to "site can't be reached" with `--web`**
Something else is on port 8765. Pick another: `--port 9999`.

**The terminal picker looks plain**
You're probably on Node 18.16 or older. Bump to **Node ≥ 18.17** (LTS).

---

## FAQ

**Does it delete deployments still receiving traffic?**
No. Anything currently serving production or aliased to a branch URL is
flagged as protected and not selectable, in either UI.

**Does it touch the project, env vars, or DNS?**
No. It only deletes individual deployments. The project, custom domains,
build configuration, and environment variables are untouched.

**Can I undo a delete?**
No. Cloudflare doesn't keep tombstones. That's why `--dry-run` and the
protection rules exist.

**Why `?force=true` on the DELETE call?**
Cloudflare returns 400 on a deployment with active aliases unless `force=true`
is set. Combined with the alias-head protection, you only ever force-delete
deployments that aren't currently aliased.

**Does it cost API quota?**
Pages API calls don't count against the standard rate limit, but the tool
also throttles deletes with a small `setTimeout(100)` between calls just to
be polite.

---

## Development

```bash
git clone https://github.com/South-Loop-Studios/cf-pages-cleaner
cd cf-pages-cleaner
npm install
node bin/cf-pages-cleaner.mjs --help
```

Project layout:

```
bin/cf-pages-cleaner.mjs       # shebang entry
src/index.mjs                  # arg parsing & dispatch
src/setup.mjs                  # guided first-run setup
src/update.mjs                 # self-upgrade flow
src/api.mjs                    # Cloudflare REST client
src/terminal.mjs               # interactive terminal flow
src/web.mjs                    # local HTTP server (NDJSON streams /api/delete)
src/web-ui.mjs                 # the single-page HTML for the GUI
src/utils.mjs                  # types, formatting, protection logic
assets/logo.png                # brand logo for the web UI
```

The whole thing is plain ESM JavaScript, no build step.

### Publishing

```bash
npm version patch              # bump
npm publish --access public    # ship
```

The `files` field in `package.json` restricts the npm tarball to `bin/`,
`src/`, `assets/`, `README.md`, and `LICENSE`.

---

## Disclaimer

This tool **permanently deletes Cloudflare Pages deployments**. Cloudflare
doesn't keep tombstones — once a deployment is gone, it's gone. The
[Protection rules](#protection-rules) and `--dry-run` flag exist to make
accidents difficult, not impossible.

**By using `cf-pages-cleaner` you accept full responsibility for the
deployments it deletes on your behalf.** South Loop Studios is not
liable for any production outage, accidental data loss, broken preview
alias, irate stakeholder, or any other direct or indirect consequence
of running this tool — including the case where you tick the wrong box,
hit enter, and nuke a deployment that turned out to be load-bearing.

If you're not 100% sure what you're deleting:

- Run with **`--dry-run`** first to preview the kill list with no API
  DELETE calls.
- Try it on a low-stakes project before pointing it at anything
  customer-facing.
- Re-deploy live branches before cleaning house — the new deployments
  inherit the aliases, and the old ones become safe to remove.

This README and the inline help are best-effort; the formal warranty
disclaimer is in [LICENSE](./LICENSE).

---

## License

MIT — see [LICENSE](./LICENSE).

<br>

<p align="center">
  <img src="assets/logo.png" alt="South Loop Studios" width="48" />
  <br>
  <sub>Maintained by <a href="https://southloopstudios.com"><strong>South Loop Studios</strong></a></sub>
</p>

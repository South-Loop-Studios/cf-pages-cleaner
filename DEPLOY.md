# Deploying cf-pages-cleaner

A walkthrough for getting the package onto **GitHub** and **npm** for the
first time. Each step is a copy-pasteable terminal command.

> **Placeholders.** Wherever you see `<YOUR-NPM-HANDLE>`, swap in your
> npm username once you've created your account in step 1. The GitHub repo
> goes under the **`South-Loop-Studios`** org, so the URL is fixed:
> <https://github.com/South-Loop-Studios/cf-pages-cleaner>.

---

## 0. Where you're starting from

You currently have the project files in a temporary workspace folder. The
first job is to copy them somewhere permanent on your Mac, e.g.
`~/Code/cf-pages-cleaner`. Open Terminal and run:

```bash
mkdir -p ~/Code/cf-pages-cleaner
# Drag the contents of the workspace folder into ~/Code/cf-pages-cleaner in Finder,
# OR run (replace the source path with the workspace folder shown by Claude):
# cp -R "/path/to/workspace/folder/." ~/Code/cf-pages-cleaner/

cd ~/Code/cf-pages-cleaner
ls
# Expected:
#   bin/  src/  package.json  README.md  LICENSE  .gitignore  DEPLOY.md
```

Quick sanity check:

```bash
node --version    # should print v18.17 or newer
npm --version     # should print something
gh --version      # should print something
```

If `gh` is missing: `brew install gh`. If `node` is missing:
`brew install node`.

---

## 1. Create an npm account

You need an npm account before you can publish.

1. Open <https://www.npmjs.com/signup>.
2. Pick a username (this becomes `<YOUR-NPM-HANDLE>`), an email, and a
   password.
3. Verify your email — npm won't let you publish until you click the
   confirmation link.
4. (Strongly recommended) Enable 2FA at
   <https://www.npmjs.com/settings/~/profile> → *Two-factor authentication*.
   You'll be prompted for an OTP on every publish.

Then log in from your terminal:

```bash
npm login
# Follow the browser flow it opens.
npm whoami
# Should print <YOUR-NPM-HANDLE>.
```

---

## 2. Confirm GitHub CLI is logged in

You said you already have `gh` installed. Make sure it's authenticated:

```bash
gh auth status
# Should say "Logged in to github.com as <YOUR-GITHUB-HANDLE>".
```

If it isn't, run `gh auth login` and follow the prompts (pick HTTPS, log
in via browser).

---

## 3. Initialise git and make the first commit

From inside `~/Code/cf-pages-cleaner`:

```bash
git init -b main
git add .
git commit -m "Initial commit"
```

---

## 4. Confirm package.json metadata

The `repository`, `homepage`, and `bugs` fields in `package.json` already
point at `github.com/South-Loop-Studios/cf-pages-cleaner`. Same for the
`git clone` line in `README.md`. **No edits needed** — sanity-check by
running:

```bash
grep -n "South-Loop-Studios" package.json README.md
```

You should see three matches in `package.json` and one in `README.md`. If
that's right, skip to step 5.

---

## 5. Create the GitHub repo and push

You need to be a member of the **South-Loop-Studios** GitHub org with
permission to create repos. Verify with `gh auth status` and confirm your
account is in the org (`gh api /user/orgs --jq '.[].login'` should list
`South-Loop-Studios`).

Then create the repo under the org and push, in one command:

```bash
gh repo create South-Loop-Studios/cf-pages-cleaner \
  --public \
  --source=. \
  --remote=origin \
  --push \
  --description "Clean up old Cloudflare Pages deployments — terminal UI with optional web GUI."
```

That:

- creates `github.com/South-Loop-Studios/cf-pages-cleaner`,
- adds it as the `origin` remote,
- pushes the `main` branch.

Verify by opening the URL it prints, or:

```bash
gh repo view --web
```

> **If `gh` says "you don't have permission to create repos in
> South-Loop-Studios"**, an org Owner needs to either invite you with the
> right role, or grant the *create repos* permission for Members. As a
> fallback, push to your personal account first and transfer the repo via
> Settings → Danger Zone → *Transfer ownership* once access is sorted.

---

## 6. Publish to npm

You need to be logged in (`npm whoami` should already work). Then:

```bash
# 1. Quick sanity check — what would actually go into the tarball?
npm pack --dry-run

# Look at the output. You should see only:
#   bin/cf-pages-cleaner.mjs
#   src/*.mjs
#   package.json
#   README.md
#   LICENSE
# If you see node_modules, .env, .git etc., something's wrong — stop and fix.

# 2. Publish.
npm publish --access public
# (--access public is required for unscoped packages on free accounts.)
```

If you have 2FA enabled, you'll be prompted for an OTP.

If publishing succeeds, the registry will assign your package a URL:

```
https://www.npmjs.com/package/cf-pages-cleaner
```

Test it works for someone fresh:

```bash
cd /tmp
npx cf-pages-cleaner --version
# Should print 0.1.0
```

---

## 7. Tag the release on GitHub

Mirror the npm version into a git tag and a GitHub release — makes the
README's *Releases* badge work and gives users a changelog hook:

```bash
git tag v0.1.0
git push origin v0.1.0

gh release create v0.1.0 \
  --title "v0.1.0 — first release" \
  --notes "Initial release. Terminal + web UI for cleaning up Cloudflare Pages deployments."
```

---

## 8. The publish loop (for next time)

When you've made changes you want to ship:

```bash
# 1. Bump the version. Pick one:
npm version patch   # 0.1.0 → 0.1.1   (bug fixes)
npm version minor   # 0.1.0 → 0.2.0   (new features, backwards compatible)
npm version major   # 0.1.0 → 1.0.0   (breaking changes)

# `npm version` also makes a git commit and a tag for you.

# 2. Push the commit and the tag.
git push && git push --tags

# 3. Publish.
npm publish

# 4. (Optional) Make a GitHub release for the new tag.
gh release create v$(node -p "require('./package.json').version") \
  --generate-notes
```

---

## 9. Optional: also publish under an npm scope

If you'd like the package to live under a South Loop Studios npm scope as
well (e.g. `@south-loop-studios/cf-pages-cleaner`), do this *after* the
unscoped publish in step 6:

1. Create the org on npm at <https://www.npmjs.com/org/create>. Pick the
   slug `south-loop-studios` (npm scopes must be lowercase).
2. Add yourself as a member.
3. Change `name` in `package.json` to `@south-loop-studios/cf-pages-cleaner`
   and bump the version (e.g. `0.1.0` → `0.1.1`).
4. Run:

   ```bash
   npm publish --access public
   ```

   `--access public` is mandatory the first time you publish a scoped
   package, otherwise npm assumes it's a private package and rejects the
   call on the free plan.

You can keep both — the unscoped name as the default `npx cf-pages-cleaner`
entry point, the scoped name as the canonical org-attributed package.

---

## Troubleshooting

**`npm publish` says "402 Payment Required"**
You're trying to publish a scoped name without `--access public`. Either
add the flag, or change `name` back to the unscoped form.

**`npm publish` says "403 You do not have permission to publish"**
Either the name is taken (run `npm view cf-pages-cleaner` — should 404 if
it's free), or you're not logged in (`npm whoami`).

**`gh repo create` says "name already exists"**
Pick a different repo name, or delete the existing one in GitHub settings.

**The published package is missing files**
Check the `files` field in `package.json` — it whitelists what ships. Run
`npm pack --dry-run` to inspect the tarball before publishing again.

**Want to unpublish the first release immediately?**
`npm unpublish cf-pages-cleaner@0.1.0 --force` — but only within 72 hours.
After that, npm freezes the version and you have to bump.

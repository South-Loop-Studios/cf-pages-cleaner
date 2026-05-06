import kleur from 'kleur';

/**
 * Normalise a Cloudflare deployment record into the shape the rest of the
 * tool consumes. Computes the protection flags too.
 *
 * @param {object} raw            raw deployment from the API
 * @param {string} canonicalId    id of the project's canonical (production) deployment
 * @param {Set<string>} aliasHeads ids that are the head of a branch alias
 */
export function normaliseDeployment(raw, canonicalId, aliasHeads) {
  const id = raw.id;
  const env = raw.environment ?? 'preview';
  const branch =
    raw?.deployment_trigger?.metadata?.branch ??
    raw?.source?.config?.production_branch ??
    '';
  return {
    id,
    shortId: id.slice(0, 8),
    url: raw.url ?? '',
    environment: env,
    branch: branch || '—',
    createdOn: raw.created_on ?? '',
    aliases: raw.aliases ?? [],
    isProduction: id === canonicalId,
    isAliasHead: aliasHeads.has(id),
    get protected() {
      return this.isProduction || this.isAliasHead;
    },
  };
}

/**
 * Given the full list of raw deployments (newest-first as returned by the
 * API), produce the set of ids that are the *head* of a branch / preview
 * alias. Cloudflare uses the most recent deployment per (env, branch) as the
 * alias head.
 */
export function computeAliasHeads(rawDeployments) {
  const seen = new Set();
  const heads = new Set();
  for (const d of rawDeployments) {
    const env = d.environment ?? 'preview';
    const branch = d?.deployment_trigger?.metadata?.branch ?? '';
    const key = `${env}::${branch}`;
    if (branch && !seen.has(key)) {
      seen.add(key);
      heads.add(d.id);
    }
  }
  return heads;
}

/** A short relative-time string like "4d ago", "2mo ago". */
export function humanAge(iso) {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return iso;
  const ms = Date.now() - t;
  const days = Math.floor(ms / 86_400_000);
  if (days <= 0) return `${Math.max(1, Math.floor(ms / 3_600_000))}h ago`;
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

/** A one-line label for a deployment in the terminal. */
export function renderDeploymentLine(d) {
  const tags = [];
  if (d.isProduction) tags.push(kleur.bgRed().white(' PROD '));
  if (d.isAliasHead && !d.isProduction) tags.push(kleur.bgYellow().black(' ALIAS '));
  const tagStr = tags.length ? ' ' + tags.join(' ') : '';
  const branch = kleur.cyan(String(d.branch).slice(0, 24).padEnd(24));
  const age = kleur.gray(humanAge(d.createdOn).padStart(7));
  const url = String(d.url).slice(0, 48);
  return `${d.shortId}  ${branch}  ${age}  ${url}${tagStr}`;
}

/** Heading helper. */
export function bold(s) {
  return kleur.bold(s);
}

export const c = kleur;

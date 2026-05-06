import { computeAliasHeads, normaliseDeployment } from './utils.mjs';

const CF_API = 'https://api.cloudflare.com/client/v4';
const PAGE_SIZE = 25;

/**
 * Tiny wrapper around Cloudflare's REST API. Uses the global `fetch` (Node
 * 18.17+).
 */
export class CloudflareClient {
  /**
   * @param {{ token: string, accountId: string }} cfg
   */
  constructor({ token, accountId }) {
    if (!token) throw new Error('Missing API token.');
    if (!accountId) throw new Error('Missing account ID.');
    this.token = token;
    this.accountId = accountId;
  }

  async #request(method, path, body) {
    const url = `${CF_API}${path}`;
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    let data;
    const text = await res.text();
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(
        `Non-JSON response from ${path} (${res.status}): ${text.slice(0, 200)}`,
      );
    }
    if (!res.ok || data.success === false) {
      const msg =
        data?.errors?.[0]?.message || `${res.status} ${res.statusText}`;
      throw new Error(`Cloudflare API: ${msg}`);
    }
    return data;
  }

  async listProjects() {
    const data = await this.#request(
      'GET',
      `/accounts/${this.accountId}/pages/projects`,
    );
    return data.result ?? [];
  }

  /** Walk every page of deployments for `projectName`. */
  async listDeployments(projectName) {
    const out = [];
    for (let page = 1; page <= 200; page++) {
      const data = await this.#request(
        'GET',
        `/accounts/${this.accountId}/pages/projects/${encodeURIComponent(
          projectName,
        )}/deployments?page=${page}&per_page=${PAGE_SIZE}`,
      );
      const chunk = data.result ?? [];
      out.push(...chunk);
      if (chunk.length < PAGE_SIZE) break;
    }
    return out;
  }

  async deleteDeployment(projectName, deploymentId, { force = true } = {}) {
    const qs = force ? '?force=true' : '';
    await this.#request(
      'DELETE',
      `/accounts/${this.accountId}/pages/projects/${encodeURIComponent(
        projectName,
      )}/deployments/${encodeURIComponent(deploymentId)}${qs}`,
    );
  }
}

/**
 * Fetch and normalise every deployment for one project, with protection
 * flags filled in.
 *
 * @param {CloudflareClient} client
 * @param {string} projectName
 */
export async function fetchDeployments(client, projectName) {
  const projects = await client.listProjects();
  const project = projects.find((p) => p.name === projectName);
  if (!project) {
    throw new Error(`Project '${projectName}' not found in this account.`);
  }
  const canonicalId =
    project?.canonical_deployment?.id ?? project?.latest_deployment?.id ?? '';

  const raw = await client.listDeployments(projectName);
  const aliasHeads = computeAliasHeads(raw);
  return raw.map((d) => normaliseDeployment(d, canonicalId, aliasHeads));
}

import { checkbox, confirm, select } from '@inquirer/prompts';
import { fetchDeployments } from './api.mjs';
import { bold, c, renderDeploymentLine } from './utils.mjs';

/**
 * Pick a project, either from the --project flag or via an interactive
 * select prompt.
 */
export async function pickProject(client, preselected) {
  const projects = await client.listProjects();
  if (projects.length === 0) {
    throw new Error('No Pages projects on this account.');
  }
  const names = projects.map((p) => p.name);
  if (preselected) {
    if (!names.includes(preselected)) {
      throw new Error(
        `Project '${preselected}' not found. Available: ${names.join(', ')}`,
      );
    }
    return preselected;
  }
  if (names.length === 1) return names[0];

  return await select({
    message: 'Select a Pages project:',
    choices: names.map((n) => ({ name: n, value: n })),
  });
}

/**
 * Show protected deployments above the picker, then offer the rest in a
 * checkbox list.
 */
export async function selectDeployments(deployments) {
  const protectedOnes = deployments.filter((d) => d.protected);
  const deletable = deployments.filter((d) => !d.protected);

  if (deletable.length === 0) {
    console.log(c.yellow('Nothing to clean up — every deployment is protected.'));
    return [];
  }

  if (protectedOnes.length) {
    console.log(bold('Protected (not selectable):'));
    for (const d of protectedOnes) {
      console.log('  ' + renderDeploymentLine(d));
    }
    console.log();
  }

  const picked = await checkbox({
    message:
      'Tick deployments to delete (space toggles, a toggles all, enter confirms):',
    pageSize: 20,
    choices: deletable.map((d) => ({
      name: renderDeploymentLine(d),
      value: d.id,
    })),
  });

  const ids = new Set(picked);
  return deletable.filter((d) => ids.has(d.id));
}

/**
 * Top-level terminal flow.
 */
export async function runTerminal(client, args) {
  const project = await pickProject(client, args.project);
  console.log(`\n${bold('Project:')} ${project}`);
  console.log(c.gray('Loading deployments…'));

  const deployments = await fetchDeployments(client, project);
  if (deployments.length === 0) {
    console.log('No deployments found.');
    return 0;
  }

  const protectedCount = deployments.filter((d) => d.protected).length;
  console.log(
    `Found ${deployments.length} deployments (${protectedCount} protected).\n`,
  );

  const targets = await selectDeployments(deployments);
  if (targets.length === 0) {
    console.log('Nothing selected.');
    return 0;
  }

  console.log();
  console.log(bold(`About to delete ${targets.length} deployment(s):`));
  for (const d of targets) {
    console.log('  ' + renderDeploymentLine(d));
  }
  console.log();

  if (args.dryRun) {
    console.log(c.yellow('--dry-run set; skipping deletion.'));
    return 0;
  }

  const ok = await confirm({
    message: c.red(`Delete ${targets.length} deployment(s)?`),
    default: false,
  });
  if (!ok) {
    console.log('Aborted.');
    return 0;
  }

  let fails = 0;
  for (const d of targets) {
    try {
      await client.deleteDeployment(project, d.id);
      console.log(c.green(`  ✓ deleted ${d.shortId}  ${d.url}`));
    } catch (err) {
      fails++;
      console.log(c.red(`  ✗ failed  ${d.shortId}: ${err.message}`));
    }
    // tiny pause to be polite
    await new Promise((r) => setTimeout(r, 100));
  }

  if (fails) {
    console.log(c.red(`\nDone with ${fails} failure(s).`));
    return 1;
  }
  console.log(c.green(`\nDeleted ${targets.length} deployments.`));
  return 0;
}

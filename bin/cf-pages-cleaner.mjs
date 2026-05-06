#!/usr/bin/env node
import { main } from '../src/index.mjs';

try {
  const code = await main(process.argv.slice(2));
  process.exit(code ?? 0);
} catch (err) {
  if (err && err.name === 'ExitPromptError') {
    // user hit ctrl-c in an inquirer prompt
    process.stderr.write('\nCancelled.\n');
    process.exit(130);
  }
  process.stderr.write(`Error: ${err?.message ?? err}\n`);
  process.exit(1);
}

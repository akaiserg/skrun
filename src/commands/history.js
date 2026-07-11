import { loadRegistry } from '../registry.js';

export function historyCommand(flags) {
  const registry = loadRegistry();
  const filter = typeof flags.history === 'string' ? flags.history : null;

  let entries = registry.history;

  if (filter === 'deleted') {
    entries = entries.filter(e => e.action === 'expire' || e.action === 'delete');
  } else if (filter && filter !== true) {
    entries = entries.filter(e => e.action === filter);
  }

  if (entries.length === 0) {
    console.log('No history entries' + (filter ? ` matching "${filter}"` : '') + '.');
    return;
  }

  console.log(`History${filter ? ` (${filter})` : ''} — ${entries.length} entries:\n`);
  for (const e of entries) {
    const time = new Date(e.timestamp).toLocaleString();
    const project = e.projectPath ? ` in ${e.projectPath}` : '';
    console.log(`  [${e.action}] ${e.skill}${project} — ${time}`);
  }
}

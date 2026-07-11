import { existsSync } from 'fs';
import { listStore, findByTag } from '../skills.js';
import { loadRegistry } from '../registry.js';

export function listCommand(flags) {
  if (flags.installed) {
    return listInstalled();
  }

  const tag = flags.tag;

  let skills;
  if (tag) {
    const matchAll = flags.match === 'all';
    skills = findByTag(tag, matchAll);
    if (skills.length === 0) {
      console.warn(`No skills found matching tag "${tag}".`);
      return;
    }
  } else {
    skills = listStore();
  }

  if (skills.length === 0) {
    console.log('No skills in store. Use "skrun import <repo>" to add skills.');
    return;
  }

  console.log(`Skills in store (${skills.length}):\n`);
  for (const s of skills) {
    const tags = s.tags.length > 0 ? `  [${s.tags.join(', ')}]` : '';
    console.log(`  ${s.id}${tags}`);
  }
}

function listInstalled() {
  const registry = loadRegistry();
  const installs = registry.installs;

  if (installs.length === 0) {
    console.log('No active installs. Use "skrun install <skill>" to install skills.');
    return;
  }

  console.log(`Active installs (${installs.length}):\n`);
  for (const i of installs) {
    const ttl = i.ttlExpiresAt ? `  expires ${new Date(i.ttlExpiresAt).toLocaleString()}` : '';
    const missing = !existsSync(i.installedPath) ? ' [missing]' : '';
    console.log(`  ${i.skill} (${i.type}) → ${i.installedPath}${ttl}${missing}`);
  }
}

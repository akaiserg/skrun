import { existsSync } from 'fs';
import { loadRegistry } from '../registry.js';
import { copyDir } from '../fsutil.js';
import { skillPath, skillExists } from '../skills.js';

export async function syncCommand(flags) {
  const dryRun = !!flags['dry-run'];
  const registry = loadRegistry();
  let synced = 0;
  let skipped = 0;

  if (registry.installs.length === 0) {
    console.log('No installs to sync.');
    return;
  }

  for (const install of [...registry.installs]) {
    if (!skillExists(install.skill)) {
      console.warn(`  Warning: skill "${install.skill}" no longer in store, skipping.`);
      skipped++;
      continue;
    }

    const src = skillPath(install.skill);

    if (install.type === 'symlink') {
      if (existsSync(install.installedPath)) {
        console.log(`  ✓ ${install.skill} → ${install.installedPath} (symlink, auto-synced)`);
      } else {
        console.warn(`  ⚠ ${install.skill} → ${install.installedPath} (symlink broken)`);
      }
      continue;
    }

    if (install.type === 'copy') {
      if (dryRun) {
        console.log(`  [dry-run] Would re-copy: ${install.skill} → ${install.installedPath}`);
      } else {
        copyDir(src, install.installedPath);
        console.log(`  ↻ ${install.skill} → ${install.installedPath} (re-copied)`);
      }
      synced++;
    }
  }

  const action = dryRun ? 'would sync' : 'synced';
  console.log(`\n${synced} copy install(s) ${action}, ${skipped} skipped.`);
}

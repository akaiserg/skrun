import { loadRegistry, saveRegistry, removeInstall, appendHistory } from '../registry.js';
import { forceRemove } from '../fsutil.js';
import { removeScheduler } from '../ttl.js';

export function uninstallCommand(args, flags) {
  const skillName = args[0];
  if (!skillName) {
    throw new Error('Usage: skrun uninstall <skill> [--target=claude|github|opencode|agents]');
  }

  const targetFilter = flags.target || null;
  const registry = loadRegistry();

  const matches = registry.installs.filter(i => {
    if (i.skill !== skillName) return false;
    if (targetFilter) {
      return i.installedPath.includes(`/.${targetFilter}/`) || i.installedPath.includes(`\\.${targetFilter}\\`);
    }
    return true;
  });

  if (matches.length === 0) {
    console.log(`No active installs found for "${skillName}".`);
    return;
  }

  let removed = 0;
  for (const install of matches) {
    forceRemove(install.installedPath);
    removeInstall(registry, install.installedPath);
    appendHistory(registry, 'uninstall', { skill: install.skill, projectPath: install.projectPath });
    console.log(`  Removed: ${install.skill} (${install.installedPath})`);
    removed++;
  }

  saveRegistry(registry);

  const hasTtl = registry.installs.some(i => i.ttlExpiresAt);
  if (!hasTtl) {
    removeScheduler();
  }

  console.log(`\n${removed} install(s) removed.`);
}

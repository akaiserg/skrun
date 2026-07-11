import { loadRegistry, saveRegistry, appendHistory } from '../registry.js';
import { forceRemove } from '../fsutil.js';
import { removeScheduler } from '../ttl.js';
import { logInfo, logError } from '../logger.js';

export function purgeCommand() {
  return purgeExpired(true);
}

export function purgeExpired(verbose = false) {
  const registry = loadRegistry();
  const now = Date.now();
  let purged = 0;

  const expired = registry.installs.filter(
    i => i.ttlExpiresAt && new Date(i.ttlExpiresAt).getTime() <= now
  );

  const purgedPaths = new Set();
  for (const install of expired) {
    try {
      forceRemove(install.installedPath);
      purgedPaths.add(install.installedPath);
      appendHistory(registry, 'expire', {
        skill: install.skill,
        projectPath: install.projectPath
      });
      logInfo('purge', `Expired: ${install.skill}`, install.installedPath);
      if (verbose) {
        console.log(`  Expired: ${install.skill} (${install.installedPath})`);
      }
      purged++;
    } catch (err) {
      logError('purge', `Failed to purge ${install.skill}: ${err.message}`, install.installedPath);
      if (verbose) {
        console.error(`  Error purging ${install.skill}: ${err.message}`);
      }
    }
  }

  if (purged > 0) {
    registry.installs = registry.installs.filter(i => !purgedPaths.has(i.installedPath));
    saveRegistry(registry);
  }

  const hasTtl = registry.installs.some(i => i.ttlExpiresAt);
  if (!hasTtl) {
    removeScheduler();
  }

  if (verbose) {
    if (purged === 0) {
      console.log('No expired installs.');
    } else {
      console.log(`\n${purged} install(s) purged.`);
    }
  }

  return purged;
}

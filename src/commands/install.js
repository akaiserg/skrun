import { join } from 'path';
import { skillExists, skillPath, findByTag } from '../skills.js';
import { resolveTargets } from '../targets.js';
import { linkOrCopy } from '../fsutil.js';
import { loadRegistry, saveRegistry, addInstall, removeInstall } from '../registry.js';
import { ensureScheduler } from '../ttl.js';

function parseTTL(value) {
  const str = String(value).trim().toLowerCase();
  const match = str.match(/^(\d+(?:\.\d+)?)\s*(s|m|h)?$/);
  if (!match) return NaN;
  const num = parseFloat(match[1]);
  const unit = match[2] || 'h';
  const multipliers = { s: 1000, m: 60000, h: 3600000 };
  return num * multipliers[unit];
}

export async function installCommand(args, flags) {
  const skillName = args[0];
  const tag = flags.tag;
  const copy = !!flags.copy;
  const ttlMs = flags.ttl ? parseTTL(flags.ttl) : null;
  const targetFlag = flags.target || null;
  const matchAll = flags.match === 'all';

  let skillsToInstall = [];

  if (tag) {
    skillsToInstall = findByTag(tag, matchAll);
    if (skillsToInstall.length === 0) {
      console.warn(`Warning: no skills found matching tag "${tag}".`);
      return;
    }
    console.log(`Found ${skillsToInstall.length} skill(s) matching tag "${tag}".`);
  } else if (skillName) {
    if (!skillExists(skillName)) {
      throw new Error(`Skill "${skillName}" not found in store. Run "skrun list" to see available skills.`);
    }
    skillsToInstall = [{ id: skillName }];
  } else {
    throw new Error('Usage: skrun install <skill> or skrun install --tag=<tag>');
  }

  const targets = resolveTargets(process.cwd(), targetFlag);
  const registry = loadRegistry();

  let ttlExpiresAt = null;
  if (ttlMs !== null) {
    if (ttlMs <= 0) {
      throw new Error('--ttl must be a positive value (e.g. 30s, 15m, 2h, or 4 for hours).');
    }
    ttlExpiresAt = new Date(Date.now() + ttlMs).toISOString();
  }

  let installed = 0;

  for (const skill of skillsToInstall) {
    const src = skillPath(skill.id);

    for (const target of targets) {
      const dst = join(target.skillsPath, skill.id);
      removeInstall(registry, dst);
      const type = linkOrCopy(src, dst, { copy });

      addInstall(registry, {
        skill: skill.id,
        projectPath: process.cwd(),
        installedPath: dst,
        type,
        ttlExpiresAt
      });

      const ttlNote = ttlExpiresAt ? ` (expires: ${ttlExpiresAt})` : '';
      console.log(`  ${type}: ${skill.id} → ${target.agent}${ttlNote}`);
      installed++;
    }
  }

  saveRegistry(registry);

  if (ttlExpiresAt) {
    ensureScheduler();
  }

  console.log(`\n${installed} install(s) completed.`);
}

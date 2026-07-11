import { existsSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';

const AGENT_DIRS = {
  claude: '.claude',
  github: '.github',
  opencode: '.opencode',
  agents: '.agents'
};

export function resolveTargets(cwd, targetFlag) {
  const projectRoot = resolve(cwd);

  if (targetFlag && targetFlag !== 'all') {
    const agentDir = AGENT_DIRS[targetFlag];
    if (!agentDir) {
      throw new Error(`Unknown target: ${targetFlag}. Use: claude, github, opencode, agents, or all`);
    }
    const skillsPath = join(projectRoot, agentDir, 'skills');
    mkdirSync(skillsPath, { recursive: true });
    return [{ agent: targetFlag, skillsPath }];
  }

  const detected = [];
  for (const [agent, dir] of Object.entries(AGENT_DIRS)) {
    if (existsSync(join(projectRoot, dir))) {
      detected.push({ agent, skillsPath: join(projectRoot, dir, 'skills') });
    }
  }

  if (detected.length === 0) {
    const fallback = join(projectRoot, '.agents', 'skills');
    mkdirSync(fallback, { recursive: true });
    return [{ agent: 'agents', skillsPath: fallback }];
  }

  if (targetFlag === 'all') {
    for (const t of detected) {
      mkdirSync(t.skillsPath, { recursive: true });
    }
    return detected;
  }

  for (const t of detected) {
    mkdirSync(t.skillsPath, { recursive: true });
  }
  return detected;
}

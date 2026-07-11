import { readFileSync, writeFileSync, renameSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { tmpdir } from 'os';
import { registryPath } from './config.js';

function freshRegistry() {
  return { installs: [], history: [] };
}

export function loadRegistry() {
  try {
    const data = readFileSync(registryPath, 'utf8');
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed.installs)) parsed.installs = [];
    if (!Array.isArray(parsed.history)) parsed.history = [];
    return parsed;
  } catch {
    return freshRegistry();
  }
}

export function saveRegistry(registry) {
  mkdirSync(dirname(registryPath), { recursive: true });
  const tmp = join(dirname(registryPath), `.registry-${Date.now()}.tmp`);
  writeFileSync(tmp, JSON.stringify(registry, null, 2) + '\n');
  renameSync(tmp, registryPath);
}

export function addInstall(registry, { skill, projectPath, installedPath, type, ttlExpiresAt }) {
  registry.installs.push({
    skill,
    projectPath,
    installedPath,
    type,
    ttlExpiresAt: ttlExpiresAt || null
  });
  appendHistory(registry, 'install', { skill, projectPath });
}

export function removeInstall(registry, installedPath) {
  const idx = registry.installs.findIndex(i => i.installedPath === installedPath);
  if (idx !== -1) {
    const entry = registry.installs[idx];
    registry.installs.splice(idx, 1);
    return entry;
  }
  return null;
}

export function appendHistory(registry, action, { skill, projectPath }) {
  registry.history.push({
    action,
    skill,
    timestamp: new Date().toISOString(),
    projectPath: projectPath || null
  });
}

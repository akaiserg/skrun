import { readdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { join, basename } from 'path';
import { skillsDir } from './config.js';

export function scanForSkills(rootDir) {
  const results = [];
  walk(rootDir, results);
  return results;
}

function walk(dir, results) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  const hasSkillMd = entries.some(e => !e.isDirectory() && e.name === 'SKILL.md');
  if (hasSkillMd) {
    results.push({ name: basename(dir), path: dir });
    return; // skill folder found — don't recurse into subdirs
  }
  for (const entry of entries) {
    if (entry.isDirectory() && !entry.name.startsWith('.')) {
      walk(join(dir, entry.name), results);
    }
  }
}

export function listStore() {
  if (!existsSync(skillsDir)) return [];
  const entries = readdirSync(skillsDir, { withFileTypes: true });
  return entries
    .filter(e => e.isDirectory())
    .map(e => {
      const id = e.name;
      const tags = getTags(id);
      return { id, tags };
    });
}

export function skillExists(id) {
  return existsSync(join(skillsDir, id));
}

export function skillPath(id) {
  return join(skillsDir, id);
}

export function getTags(id) {
  const metaPath = join(skillsDir, id, 'skrun.json');
  try {
    const data = JSON.parse(readFileSync(metaPath, 'utf8'));
    return Array.isArray(data.tags) ? data.tags : [];
  } catch {
    return [];
  }
}

export function setTags(id, tags) {
  const metaPath = join(skillsDir, id, 'skrun.json');
  let data = {};
  try {
    data = JSON.parse(readFileSync(metaPath, 'utf8'));
  } catch {
    // fresh
  }
  data.tags = tags;
  writeFileSync(metaPath, JSON.stringify(data, null, 2) + '\n');
}

export function findByTag(tag, matchAll = false) {
  const store = listStore();
  const tags = Array.isArray(tag) ? tag : tag.split(',');
  return store.filter(s => {
    const skillTags = new Set(s.tags);
    if (matchAll) {
      return tags.every(t => skillTags.has(t));
    }
    return tags.some(t => skillTags.has(t));
  });
}

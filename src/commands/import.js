import { execFileSync } from 'child_process';
import { join, resolve } from 'path';
import { tmpdir } from 'os';
import { existsSync } from 'fs';
import { skillsDir } from '../config.js';
import { scanForSkills, skillExists, getTags, setTags } from '../skills.js';
import { copyDir, forceRemove } from '../fsutil.js';
import { multiSelect, confirm, prompt } from '../tui.js';

export async function importCommand(args, flags) {
  const repo = args[0];
  if (!repo) {
    throw new Error('Usage: skrun import <repo|path>');
  }

  const localPath = resolve(repo);
  const isLocal = existsSync(localPath);

  let tmpDir = null;
  let sourceDir;

  try {
    if (isLocal) {
      sourceDir = localPath;
    } else {
      try {
        execFileSync('git', ['--version'], { stdio: 'ignore' });
      } catch {
        throw new Error('git is not installed or not on PATH. Install git to use skrun import.');
      }
      tmpDir = join(tmpdir(), `skrun-import-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
      console.log(`Cloning ${repo}...`);
      execFileSync('git', ['clone', '--depth', '1', repo, tmpDir], { stdio: 'pipe' });
      sourceDir = tmpDir;
    }

    const skills = scanForSkills(sourceDir);

    if (skills.length === 0) {
      console.log('No skills found (no folders containing SKILL.md).');
      return;
    }

    console.log(`Found ${skills.length} skill(s).\n`);

    let selected;
    if (flags.force && skills.length > 0) {
      selected = skills;
      console.log(`Auto-selecting all ${skills.length} skills (--force).`);
    } else {
      selected = await multiSelect(
        skills.map(s => ({ ...s, label: s.name })),
        { message: 'Select skills to import:' }
      );
    }

    if (selected.length === 0) {
      console.log('No skills selected.');
      return;
    }

    let imported = 0;
    const importedNames = [];

    for (const skill of selected) {
      const dest = join(skillsDir, skill.name);

      if (skillExists(skill.name) && !flags.force) {
        const replace = await confirm(`Skill "${skill.name}" already exists. Replace?`);
        if (!replace) {
          console.log(`  Skipped ${skill.name}`);
          continue;
        }
        forceRemove(dest);
      }

      copyDir(skill.path, dest);
      console.log(`  Imported ${skill.name}`);
      imported++;
      if (getTags(skill.name).length === 0) {
        importedNames.push(skill.name);
      }
    }

    if (importedNames.length > 0 && !flags.force && process.stdin.isTTY) {
      await promptBatchTags(importedNames);
    }

    console.log(`\nDone. ${imported} skill(s) imported, ${selected.length - imported} skipped.`);
  } finally {
    if (tmpDir) forceRemove(tmpDir);
  }
}

function parseTags(input) {
  if (!input) return [];
  return input.split(',').map(t => t.trim()).filter(Boolean);
}

async function promptBatchTags(skillNames) {
  const batchAnswer = await prompt(`\n  Tags for all ${skillNames.length} imported skill(s) (comma-separated, enter to skip): `);
  const batchTags = parseTags(batchAnswer);

  if (batchTags.length > 0) {
    for (const name of skillNames) {
      setTags(name, batchTags);
    }
    console.log(`  Tagged ${skillNames.length} skill(s): ${batchTags.join(', ')}`);
  }

  const doIndividual = await confirm('  Tag skills individually?');
  if (!doIndividual) return;

  for (const name of skillNames) {
    const answer = await prompt(`  Additional tags for "${name}" (comma-separated, enter to skip): `);
    const extra = parseTags(answer);
    if (extra.length > 0) {
      const current = getTags(name);
      const merged = [...new Set([...current, ...extra])];
      setTags(name, merged);
      console.log(`  Tagged ${name}: ${merged.join(', ')}`);
    }
  }
}

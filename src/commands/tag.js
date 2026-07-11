import { skillExists, getTags, setTags } from '../skills.js';

export function tagCommand(args, flags) {
  const subcommand = args[0];
  const skillName = args[1];

  if (!subcommand || !skillName) {
    throw new Error('Usage: skrun tag <add|remove|list> <skill> [tags...]');
  }

  if (!skillExists(skillName)) {
    throw new Error(`Skill "${skillName}" not found in store.`);
  }

  switch (subcommand) {
    case 'add': {
      const newTags = args.slice(2);
      if (newTags.length === 0) {
        throw new Error('Usage: skrun tag add <skill> <tags...>');
      }
      const current = getTags(skillName);
      const merged = [...new Set([...current, ...newTags])];
      setTags(skillName, merged);
      console.log(`Tags for ${skillName}: ${merged.join(', ')}`);
      break;
    }

    case 'remove': {
      const removeTags = args.slice(2);
      if (removeTags.length === 0) {
        throw new Error('Usage: skrun tag remove <skill> <tags...>');
      }
      const current = getTags(skillName);
      const unknown = removeTags.filter(t => !current.includes(t));
      if (unknown.length > 0) {
        console.warn(`Warning: tags not found: ${unknown.join(', ')}`);
      }
      const filtered = current.filter(t => !removeTags.includes(t));
      setTags(skillName, filtered);
      console.log(`Tags for ${skillName}: ${filtered.length ? filtered.join(', ') : '(none)'}`);
      break;
    }

    case 'list': {
      const tags = getTags(skillName);
      if (tags.length === 0) {
        console.log(`${skillName}: (no tags)`);
      } else {
        console.log(`${skillName}: ${tags.join(', ')}`);
      }
      break;
    }

    default:
      throw new Error(`Unknown tag subcommand: ${subcommand}. Use: add, remove, list`);
  }
}

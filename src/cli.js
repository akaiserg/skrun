import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { ensureConfig } from './config.js';
import { logInfo, logError } from './logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { version: VERSION } = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'));

const USAGE = `skrun v${VERSION} — Standard Agent Skill Manager

Usage:
  skrun import <repo>                     Import skills from a git repository
  skrun import <path>                     Import skills from a local folder
  skrun install <skill> [options]         Install a skill into current project
  skrun install --tag=<tag> [options]     Install skills matching tag
  skrun uninstall <skill> [--target=<t>]  Remove an installed skill from project
  skrun sync [--dry-run]                  Sync installed copies from global store
  skrun list [--tag=<tag>]                List skills in global store
  skrun list --installed                  Show where skills are installed
  skrun tag add <skill> <tags...>         Add tags to a skill
  skrun tag remove <skill> <tags...>      Remove tags from a skill
  skrun tag list <skill>                  List tags for a skill
  skrun purge                             Remove expired TTL installs
  skrun logs [--errors] [--lines=N]       View CLI logs (--clear to wipe)
  skrun --history [deleted]               Show install/removal history
  skrun --help                            Show this help
  skrun --version                         Show version

Install options:
  --target=claude|github|opencode|agents|all     Target agent directory (default: auto-detect)
  --copy                                Copy instead of symlink
  --ttl=<duration>                       Auto-remove after duration (e.g. 30s, 15m, 2h, or 4 for hours)
  --match=all                           Require all tags (default: any)
  --force                               Overwrite without prompting`;

export function parseArgs(argv) {
  const positionals = [];
  const flags = {};

  for (const arg of argv) {
    if (arg.startsWith('--')) {
      const eq = arg.indexOf('=');
      if (eq !== -1) {
        flags[arg.slice(2, eq)] = arg.slice(eq + 1);
      } else {
        flags[arg.slice(2)] = true;
      }
    } else {
      positionals.push(arg);
    }
  }

  return { positionals, flags };
}

export async function run(argv) {
  const { positionals, flags } = parseArgs(argv);

  if (flags.version) {
    console.log(`skrun v${VERSION}`);
    return;
  }

  if (flags.help) {
    console.log(USAGE);
    return;
  }

  if (flags.history !== undefined) {
    ensureConfig();
    const { historyCommand } = await import('./commands/history.js');
    return historyCommand(flags);
  }

  const command = positionals[0];

  if (!command) {
    console.log(USAGE);
    return;
  }

  ensureConfig();

  // Opportunistic purge — clean expired TTL installs on every invocation (except purge itself)
  if (command !== 'purge') {
    try {
      const { purgeExpired } = await import('./commands/purge.js');
      purgeExpired(false);
    } catch {
      // best-effort, don't block the command
    }
  }

  try {
    switch (command) {
      case 'import': {
        const { importCommand } = await import('./commands/import.js');
        return await importCommand(positionals.slice(1), flags);
      }
      case 'install': {
        const { installCommand } = await import('./commands/install.js');
        return await installCommand(positionals.slice(1), flags);
      }
      case 'uninstall': {
        const { uninstallCommand } = await import('./commands/uninstall.js');
        return uninstallCommand(positionals.slice(1), flags);
      }
      case 'sync': {
        const { syncCommand } = await import('./commands/sync.js');
        return await syncCommand(flags);
      }
      case 'list': {
        const { listCommand } = await import('./commands/list.js');
        return listCommand(flags);
      }
      case 'tag': {
        const { tagCommand } = await import('./commands/tag.js');
        return tagCommand(positionals.slice(1), flags);
      }
      case 'purge': {
        const { purgeCommand } = await import('./commands/purge.js');
        return purgeCommand();
      }
      case 'logs': {
        const { logsCommand } = await import('./commands/logs.js');
        return logsCommand(flags);
      }
      default:
        console.error(`Unknown command: ${command}`);
        console.error('Run "skrun --help" for usage.');
        process.exitCode = 1;
    }
  } catch (err) {
    logError(command, err.message, err.stack);
    console.error(`Error: ${err.message}`);
    process.exitCode = 1;
  }
}

import { appendFileSync, mkdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { configDir } from './config.js';

const MAX_LOG_SIZE = 512 * 1024; // 512KB
const logPath = join(configDir, 'skrun.log');
let dirEnsured = false;
let rotateChecked = false;

function ensureLogDir() {
  if (dirEnsured) return;
  mkdirSync(dirname(logPath), { recursive: true });
  dirEnsured = true;
}

function rotateIfNeeded() {
  if (rotateChecked) return;
  rotateChecked = true;
  try {
    if (existsSync(logPath) && statSync(logPath).size > MAX_LOG_SIZE) {
      const content = readFileSync(logPath, 'utf8');
      const lines = content.trimEnd().split('\n');
      writeFileSync(logPath, lines.slice(Math.floor(lines.length / 2)).join('\n') + '\n');
    }
  } catch {
    // best-effort
  }
}

export function log(level, command, message, detail) {
  try {
    ensureLogDir();
    rotateIfNeeded();
    const entry = JSON.stringify({
      ts: new Date().toISOString(),
      level,
      command: command || null,
      message,
      detail: detail || null
    });
    appendFileSync(logPath, entry + '\n');
  } catch {
    // logging should never break the CLI
  }
}

export function logInfo(command, message, detail) {
  log('info', command, message, detail);
}

export function logError(command, message, detail) {
  log('error', command, message, detail);
}

export function readLogs({ lines = 50, level } = {}) {
  if (!existsSync(logPath)) return [];
  const content = readFileSync(logPath, 'utf8').trimEnd();
  if (!content) return [];
  const rawLines = content.split('\n');
  const results = [];
  // iterate from end to avoid parsing the entire file when only recent entries are needed
  for (let i = rawLines.length - 1; i >= 0 && results.length < lines; i--) {
    try {
      const entry = JSON.parse(rawLines[i]);
      if (!level || entry.level === level) {
        results.push(entry);
      }
    } catch { /* skip malformed */ }
  }
  return results.reverse();
}

export function clearLogs() {
  if (existsSync(logPath)) {
    writeFileSync(logPath, '');
  }
}

export { logPath };

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs } from '../src/cli.js';

describe('parseArgs', () => {
  it('parses positional args', () => {
    const { positionals, flags } = parseArgs(['install', 'tdd']);
    assert.deepStrictEqual(positionals, ['install', 'tdd']);
    assert.deepStrictEqual(flags, {});
  });

  it('parses --key=value flags', () => {
    const { positionals, flags } = parseArgs(['install', '--target=claude', '--ttl=2']);
    assert.deepStrictEqual(positionals, ['install']);
    assert.equal(flags.target, 'claude');
    assert.equal(flags.ttl, '2');
  });

  it('parses boolean flags', () => {
    const { flags } = parseArgs(['--copy', '--force', '--help']);
    assert.equal(flags.copy, true);
    assert.equal(flags.force, true);
    assert.equal(flags.help, true);
  });

  it('mixed positionals and flags', () => {
    const { positionals, flags } = parseArgs(['install', 'tdd', '--copy', '--ttl=1']);
    assert.deepStrictEqual(positionals, ['install', 'tdd']);
    assert.equal(flags.copy, true);
    assert.equal(flags.ttl, '1');
  });
});

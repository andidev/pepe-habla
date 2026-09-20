import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * The whole reason a web or Expo build is cheap is that core is pure. That is
 * easy to break by accident and invisible until the port, so it gets a test.
 */
test('core imports nothing from node:, react or react-native', async () => {
  const dir = import.meta.dirname;
  const files = (await readdir(dir)).filter(
    (f) => f.endsWith('.ts') && !f.endsWith('.test.ts'),
  );
  assert.ok(files.length > 0, 'expected source files to scan');

  const offenders: string[] = [];
  for (const file of files) {
    const text = await readFile(join(dir, file), 'utf8');
    for (const m of text.matchAll(/from\s+'([^']+)'/g)) {
      const spec = m[1]!;
      if (spec.startsWith('node:') || spec === 'react' || spec === 'react-native') {
        offenders.push(`${file} imports ${spec}`);
      }
    }
  }
  assert.deepEqual(offenders, []);
});

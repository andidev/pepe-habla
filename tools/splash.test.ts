import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// The native splash and the JS splash after it must draw the same image at
// the same size, or the name and Pepe jump at the handover. app.json's
// imageWidth is the one number both sides take their size from.
const app = JSON.parse(readFileSync('apps/app/app.json', 'utf8'));
const plugin = app.expo.plugins.find(
  (p: unknown) => Array.isArray(p) && p[0] === 'expo-splash-screen',
)[1];

/** Width and height from a PNG's IHDR chunk. */
function pngSize(path: string): { width: number; height: number } {
  const b = readFileSync(path);
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

describe('splash image', () => {
  test('the native splash uses the generated splash image', () => {
    assert.equal(plugin.image, './assets/splash.png');
  });
  test('is square, because iOS fits it into an imageWidth-sized square', () => {
    const { width, height } = pngSize('apps/app/assets/splash.png');
    assert.equal(width, height);
  });
  test('is drawn at 3x imageWidth, so the name stays sharp on a 3x screen', () => {
    assert.equal(pngSize('apps/app/assets/splash.png').width, plugin.imageWidth * 3);
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { parseWithTonal } from './chordRepository.js';

describe('chordRepository', () => {
  describe('parseWithTonal', () => {
    it('should fall back to local parsing when Tonal import fails (major)', async () => {
      // In Node.js environment without network imports enabled,
      // the dynamic import to 'https://esm.sh/...' will automatically fail,
      // forcing the catch block to execute and use romanToChordSymbols.
      const result = await parseWithTonal(["I", "IV", "V"], "C major");
      assert.deepStrictEqual(result, ['C', 'F', 'G']);
    });

    it('should correctly handle minor keys during fallback', async () => {
      const result = await parseWithTonal(["i", "iv", "V"], "A minor");
      assert.deepStrictEqual(result, ['Am', 'Dm', 'E']);
    });
  });
});

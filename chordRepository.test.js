import { test, describe, it } from 'node:test';
import assert from 'node:assert';
import { parseKey, CHORD_PROGRESSIONS } from './chordRepository.js';

describe('chordRepository', () => {
  describe('parseKey', () => {
    it('should parse normal major keys correctly', () => {
      const result = parseKey('C major');
      assert.deepStrictEqual(result, { tonic: 'C', mode: 'major', label: 'C major' });

      const result2 = parseKey('D# major');
      assert.deepStrictEqual(result2, { tonic: 'D#', mode: 'major', label: 'D# major' });

      const result3 = parseKey('Eb major');
      assert.deepStrictEqual(result3, { tonic: 'Eb', mode: 'major', label: 'Eb major' });
    });

    it('should parse normal minor keys correctly', () => {
      const result = parseKey('A minor');
      assert.deepStrictEqual(result, { tonic: 'A', mode: 'minor', label: 'A minor' });

      const result2 = parseKey('F# minor');
      assert.deepStrictEqual(result2, { tonic: 'F#', mode: 'minor', label: 'F# minor' });
    });

    it('should handle edge cases like extra spaces or different casing', () => {
      const result1 = parseKey('  g   minor  ');
      assert.deepStrictEqual(result1, { tonic: 'G', mode: 'minor', label: 'G minor' });

      const result2 = parseKey('c# MAJOR');
      assert.deepStrictEqual(result2, { tonic: 'C#', mode: 'major', label: 'C# major' });

      const result3 = parseKey('Bb MiNoR');
      assert.deepStrictEqual(result3, { tonic: 'Bb', mode: 'minor', label: 'Bb minor' });
    });

    it('should handle default parameter', () => {
      const result = parseKey();
      assert.deepStrictEqual(result, { tonic: 'C', mode: 'major', label: 'C major' });
    });

    it('should throw error for invalid configurations', () => {
      assert.throws(() => parseKey('H major'), /Invalid key configuration/);
      assert.throws(() => parseKey('C maj'), /Invalid key configuration/);
      assert.throws(() => parseKey('C#minor'), /Invalid key configuration/); // Missing space
      assert.throws(() => parseKey('C minor 7'), /Invalid key configuration/);
      assert.throws(() => parseKey(''), /Invalid key configuration/);
      assert.throws(() => parseKey(null), /Invalid key configuration/);
      assert.throws(() => parseKey(123), /Invalid key configuration/);
    });
  });

  describe('CHORD_PROGRESSIONS', () => {
    it('should have standard genres as properties', () => {
      assert.ok('pop' in CHORD_PROGRESSIONS);
      assert.ok('rock' in CHORD_PROGRESSIONS);
      assert.ok('country' in CHORD_PROGRESSIONS);
      assert.ok('hiphop' in CHORD_PROGRESSIONS);
      assert.ok('orchestral' in CHORD_PROGRESSIONS);
      assert.ok('soundtrack' in CHORD_PROGRESSIONS);
    });

    it('should contain arrays of progressions for each genre', () => {
      for (const [genre, progressions] of Object.entries(CHORD_PROGRESSIONS)) {
        assert.ok(Array.isArray(progressions), `Genre ${genre} should be an array`);
        assert.ok(progressions.length > 0, `Genre ${genre} should have at least one progression`);

        for (const prog of progressions) {
          assert.ok(Array.isArray(prog), `Progression in ${genre} should be an array`);
          assert.ok(prog.length > 0, `Progression in ${genre} should not be empty`);
          assert.strictEqual(typeof prog[0], 'string', `Progression items in ${genre} should be strings`);
        }
      }
    });

    it('should be frozen', () => {
      assert.ok(Object.isFrozen(CHORD_PROGRESSIONS));
      assert.ok(Object.isFrozen(CHORD_PROGRESSIONS.pop));
      assert.ok(Object.isFrozen(CHORD_PROGRESSIONS.pop[0]));
    });
  });
});

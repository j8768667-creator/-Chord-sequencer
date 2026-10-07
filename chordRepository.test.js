import test from 'node:test';
import assert from 'node:assert';
import { parseKey } from './chordRepository.js';

test('parseKey - Basic happy paths', (t) => {
  assert.deepStrictEqual(parseKey('C major'), { tonic: 'C', mode: 'major', label: 'C major' });
  assert.deepStrictEqual(parseKey('A minor'), { tonic: 'A', mode: 'minor', label: 'A minor' });
});

test('parseKey - Sharps and flats', (t) => {
  assert.deepStrictEqual(parseKey('F# major'), { tonic: 'F#', mode: 'major', label: 'F# major' });
  assert.deepStrictEqual(parseKey('Bb major'), { tonic: 'Bb', mode: 'major', label: 'Bb major' });
  assert.deepStrictEqual(parseKey('Eb minor'), { tonic: 'Eb', mode: 'minor', label: 'Eb minor' });
  assert.deepStrictEqual(parseKey('G# minor'), { tonic: 'G#', mode: 'minor', label: 'G# minor' });
});

test('parseKey - Case insensitivity and whitespace handling', (t) => {
  assert.deepStrictEqual(parseKey('c major'), { tonic: 'C', mode: 'major', label: 'C major' });
  assert.deepStrictEqual(parseKey('f# minor'), { tonic: 'F#', mode: 'minor', label: 'F# minor' });
  assert.deepStrictEqual(parseKey('eB Minor'), { tonic: 'EB', mode: 'minor', label: 'EB minor' });
  assert.deepStrictEqual(parseKey(' C major '), { tonic: 'C', mode: 'major', label: 'C major' });
  assert.deepStrictEqual(parseKey('D   minor'), { tonic: 'D', mode: 'minor', label: 'D minor' });
});

test('parseKey - Default argument', (t) => {
  assert.deepStrictEqual(parseKey(), { tonic: 'C', mode: 'major', label: 'C major' });
  assert.deepStrictEqual(parseKey(undefined), { tonic: 'C', mode: 'major', label: 'C major' });
});

test('parseKey - Invalid inputs (should throw)', (t) => {
  // Invalid note
  assert.throws(() => parseKey('H major'), /Invalid key configuration/);
  // Invalid mode
  assert.throws(() => parseKey('C maj'), /Invalid key configuration/);
  assert.throws(() => parseKey('C min'), /Invalid key configuration/);
  // Missing space
  assert.throws(() => parseKey('Cmajor'), /Invalid key configuration/);
  // Empty string
  assert.throws(() => parseKey(''), /Invalid key configuration/);
  // Non-string inputs that don't match after conversion
  assert.throws(() => parseKey(null), /Invalid key configuration/);
  assert.throws(() => parseKey(123), /Invalid key configuration/);
  assert.throws(() => parseKey({}), /Invalid key configuration/);
});

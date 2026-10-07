import { test } from 'node:test';
import assert from 'node:assert';
import { midiToArrangementQueue } from './midiLoader.js';

test('midiToArrangementQueue handles null parsed object', () => {
  const result = midiToArrangementQueue(null);
  assert.deepStrictEqual(result, []);
});

test('midiToArrangementQueue handles undefined parsed object', () => {
  const result = midiToArrangementQueue(undefined);
  assert.deepStrictEqual(result, []);
});

test('midiToArrangementQueue handles parsed object without notes property', () => {
  const result = midiToArrangementQueue({});
  assert.deepStrictEqual(result, []);
});

test('midiToArrangementQueue processes and sorts valid notes', () => {
  const parsed = {
    notes: [
      { time: 2, duration: 1, midi: 62, velocity: 0.8, extra: 'should be ignored' },
      { time: 1, duration: 2, midi: 60, velocity: 1.0, extra: 'should be ignored' },
    ]
  };
  const expected = [
    { time: 1, duration: 2, midi: 60, velocity: 1.0 },
    { time: 2, duration: 1, midi: 62, velocity: 0.8 },
  ];
  const result = midiToArrangementQueue(parsed);
  assert.deepStrictEqual(result, expected);
});

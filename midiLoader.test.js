import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { midiToArrangementQueue, attachMidiFileInput } from './midiLoader.js';

describe('midiLoader', () => {
  describe('midiToArrangementQueue', () => {
    test('returns empty array when parsed is null or undefined', () => {
      assert.deepEqual(midiToArrangementQueue(null), []);
      assert.deepEqual(midiToArrangementQueue(undefined), []);
      assert.deepEqual(midiToArrangementQueue({}), []);
    });

    test('extracts time, duration, midi, and velocity properties', () => {
      const parsed = {
        notes: [
          { time: 0, duration: 1, midi: 60, velocity: 1, name: 'C4', channel: 1, trackIndex: 0 }
        ]
      };
      const result = midiToArrangementQueue(parsed);
      assert.deepEqual(result, [
        { time: 0, duration: 1, midi: 60, velocity: 1 }
      ]);
    });

    test('sorts notes by time ascending', () => {
      const parsed = {
        notes: [
          { time: 2, duration: 1, midi: 62, velocity: 1 },
          { time: 0, duration: 1, midi: 60, velocity: 1 },
          { time: 1, duration: 1, midi: 61, velocity: 1 }
        ]
      };
      const result = midiToArrangementQueue(parsed);
      assert.deepEqual(result, [
        { time: 0, duration: 1, midi: 60, velocity: 1 },
        { time: 1, duration: 1, midi: 61, velocity: 1 },
        { time: 2, duration: 1, midi: 62, velocity: 1 }
      ]);
    });
  });

  describe('attachMidiFileInput', () => {
    test('returns early without errors if input is falsy', () => {
      assert.doesNotThrow(() => {
        attachMidiFileInput(null, () => {}, () => {});
      });
      assert.doesNotThrow(() => {
        attachMidiFileInput(undefined, () => {}, () => {});
      });
    });

    test('bails out early if no file is selected upon change event', async () => {
      let listenerCount = 0;
      let changeCallback = null;

      const mockInput = {
        addEventListener: (event, callback) => {
          if (event === 'change') {
            listenerCount++;
            changeCallback = callback;
          }
        },
        files: [],
        value: 'some-value'
      };

      let onLoadedCalled = false;
      let onErrorCalled = false;

      attachMidiFileInput(
        mockInput,
        () => { onLoadedCalled = true; },
        () => { onErrorCalled = true; }
      );

      assert.equal(listenerCount, 1);

      // Trigger change event
      await changeCallback();

      // No files, so it should clear value and return
      assert.equal(mockInput.value, '');
      assert.equal(onLoadedCalled, false);
      assert.equal(onErrorCalled, false);
    });
  });
});
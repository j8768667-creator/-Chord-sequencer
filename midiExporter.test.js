import test from 'node:test';
import assert from 'node:assert';
import { buildMultitrackMidi, downloadMidi } from './midiExporter.js';

test('buildMultitrackMidi creates midi with correct tracks and tempo', async () => {
  const options = {
    bpm: 140,
    tracks: {
      chords: [{ midi: 60, time: 0, duration: 1, velocity: 0.8 }],
      bass: [{ midi: 48, time: 0, duration: 0.5, velocity: 0.9 }],
      melody: [{ midi: 72, time: 0.5, duration: 0.5, velocity: 1.0 }],
      drums: [{ midi: 36, time: 0, duration: 0.1, velocity: 1.0 }]
    }
  };

  const midi = await buildMultitrackMidi(options);
  assert.ok(midi, 'Midi instance should be returned');
  assert.strictEqual(midi.tempo, 140, 'Midi tempo should be set correctly');
  assert.strictEqual(midi.tracks.length, 4, 'Should add 4 tracks');

  // Chords
  assert.strictEqual(midi.tracks[0].channel, 0);
  assert.strictEqual(midi.tracks[0].instrument.number, 0);
  assert.strictEqual(midi.tracks[0].notes.length, 1);
  assert.strictEqual(midi.tracks[0].notes[0].midi, 60);

  // Bass
  assert.strictEqual(midi.tracks[1].channel, 1);
  assert.strictEqual(midi.tracks[1].instrument.number, 33);
  assert.strictEqual(midi.tracks[1].notes.length, 1);
  assert.strictEqual(midi.tracks[1].notes[0].midi, 48);

  // Melody
  assert.strictEqual(midi.tracks[2].channel, 2);
  assert.strictEqual(midi.tracks[2].instrument.number, 24);
  assert.strictEqual(midi.tracks[2].notes.length, 1);
  assert.strictEqual(midi.tracks[2].notes[0].midi, 72);

  // Drums
  assert.strictEqual(midi.tracks[3].channel, 9);
  assert.strictEqual(midi.tracks[3].instrument.number, undefined, 'Drums should not set instrument number');
  assert.strictEqual(midi.tracks[3].notes.length, 1);
  assert.strictEqual(midi.tracks[3].notes[0].midi, 36);
});

test('buildMultitrackMidi handles missing options gracefully', async () => {
  const midi = await buildMultitrackMidi({});
  assert.ok(midi, 'Midi instance should be returned even with empty options');
  assert.strictEqual(midi.tempo, 120, 'Default tempo should be 120');
  assert.strictEqual(midi.tracks.length, 4, 'Should still add 4 tracks even if empty');
  assert.strictEqual(midi.tracks[0].notes.length, 0, 'No notes should be added');
});

test('downloadMidi triggers download properly', () => {
  // Setup mocks
  const originalBlob = globalThis.Blob;
  const originalURL = globalThis.URL;
  const originalDocument = globalThis.document;

  let blobData = null;
  let objectURL = 'blob:test-url';
  let revokeObjectURLCalled = false;
  let clicked = false;

  const mockAnchor = {
    click: () => { clicked = true; },
    remove: () => {}
  };

  let appendedElement = null;

  globalThis.Blob = class {
    constructor(data, options) {
      blobData = data;
      this.options = options;
    }
  };

  globalThis.URL = {
    createObjectURL: () => objectURL,
    revokeObjectURL: (url) => { revokeObjectURLCalled = url === objectURL; }
  };

  globalThis.document = {
    createElement: (tag) => {
      if (tag === 'a') return mockAnchor;
      return {};
    },
    body: {
      append: (el) => { appendedElement = el; }
    }
  };

  // Mock midi instance
  const mockMidi = {
    toArray: () => new Uint8Array([1, 2, 3])
  };

  try {
    downloadMidi(mockMidi, 'test.mid');

    assert.ok(blobData, 'Blob was created with data');
    assert.strictEqual(blobData[0][0], 1, 'Correct data passed to Blob');
    assert.strictEqual(mockAnchor.href, objectURL, 'Anchor href set correctly');
    assert.strictEqual(mockAnchor.download, 'test.mid', 'Anchor download set correctly');
    assert.strictEqual(appendedElement, mockAnchor, 'Anchor appended to document');
    assert.strictEqual(clicked, true, 'Anchor was clicked');
  } finally {
    // Restore globals
    globalThis.Blob = originalBlob;
    globalThis.URL = originalURL;
    globalThis.document = originalDocument;
  }
});

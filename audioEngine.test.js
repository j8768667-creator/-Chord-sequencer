import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { AudioEngine, TRACK_CONFIG } from './audioEngine.js';

describe('AudioEngine', () => {
    test('initial state is correct', () => {
        const engine = new AudioEngine();
        assert.equal(engine.ready, false);
        assert.equal(engine.disposed, false);
        assert.equal(engine.trackMuted.get('chords'), false);
        assert.equal(engine.trackMuted.get('bass'), false);
        assert.equal(engine.trackMuted.get('melody'), false);
        assert.equal(engine.trackMuted.get('drums'), false);
    });

    test('setMute and isMuted work correctly', () => {
        const engine = new AudioEngine();
        assert.equal(engine.isMuted('chords'), false);

        engine.trackGains.set('chords', { mute: false });

        engine.setMute('chords', true);
        assert.equal(engine.isMuted('chords'), true);
        assert.equal(engine.trackGains.get('chords').mute, true);
    });

    test('trigger methods do nothing if not ready', () => {
        const engine = new AudioEngine();
        // Should return early and not throw
        engine.triggerDrum('kick', 0);
        engine.triggerChord(['C4'], 0);
        engine.triggerBass('C2', 0);
        engine.triggerMelody('C4', 0);
        assert.ok(true);
    });

    test('trigger methods work when ready and unmuted', () => {
        const engine = new AudioEngine();
        engine.ready = true;

        // Mock Tone.js classes
        class DummyMembraneSynth {}
        engine.Tone = { MembraneSynth: DummyMembraneSynth };

        let chordTriggered = false;
        let bassTriggered = false;
        let melodyTriggered = false;
        let drumTriggered = false;

        engine.instruments.set('chords', { triggerAttackRelease: () => { chordTriggered = true; } });
        engine.instruments.set('bass', { triggerAttackRelease: () => { bassTriggered = true; } });
        engine.instruments.set('melody', { triggerAttackRelease: () => { melodyTriggered = true; } });
        engine.instruments.set('drums', { triggerAttackRelease: () => { drumTriggered = true; } });

        engine.triggerChord(['C4'], 0);
        engine.triggerBass('C2', 0);
        engine.triggerMelody('C4', 0);
        engine.triggerDrum('kick', 0);

        assert.equal(chordTriggered, true);
        assert.equal(bassTriggered, true);
        assert.equal(melodyTriggered, true);
        assert.equal(drumTriggered, true);
    });

    test('trigger methods do not play when muted', () => {
        const engine = new AudioEngine();
        engine.ready = true;

        class DummyMembraneSynth {}
        engine.Tone = { MembraneSynth: DummyMembraneSynth };

        let chordTriggered = false;
        let bassTriggered = false;
        let melodyTriggered = false;
        let drumTriggered = false;

        engine.instruments.set('chords', { triggerAttackRelease: () => { chordTriggered = true; } });
        engine.instruments.set('bass', { triggerAttackRelease: () => { bassTriggered = true; } });
        engine.instruments.set('melody', { triggerAttackRelease: () => { melodyTriggered = true; } });
        engine.instruments.set('drums', { triggerAttackRelease: () => { drumTriggered = true; } });

        engine.trackMuted.set('chords', true);
        engine.trackMuted.set('bass', true);
        engine.trackMuted.set('melody', true);
        engine.trackMuted.set('drums', true);

        engine.triggerChord(['C4'], 0);
        engine.triggerBass('C2', 0);
        engine.triggerMelody('C4', 0);
        engine.triggerDrum('kick', 0);

        assert.equal(chordTriggered, false);
        assert.equal(bassTriggered, false);
        assert.equal(melodyTriggered, false);
        assert.equal(drumTriggered, false);
    });

    test('triggerDrum translates midi names if not MembraneSynth', () => {
        const engine = new AudioEngine();
        engine.ready = true;

        class DummyMembraneSynth {}
        engine.Tone = { MembraneSynth: DummyMembraneSynth };

        let drumTriggeredNote = null;
        engine.instruments.set('drums', {
            triggerAttackRelease: (note) => { drumTriggeredNote = note; }
        });

        // 'kick' midi is 36 which translates to C2
        engine.triggerDrum('kick', 0);
        assert.equal(drumTriggeredNote, 'C2');

        // 'snare' midi is 38 which translates to D2
        engine.triggerDrum('snare', 0);
        assert.equal(drumTriggeredNote, 'D2');

        // 'hat' midi is 42 which translates to F#2
        engine.triggerDrum('hat', 0);
        assert.equal(drumTriggeredNote, 'F#2');
    });

    test('triggerDrum hardcodes specific notes if it is a MembraneSynth', () => {
        const engine = new AudioEngine();
        engine.ready = true;

        class DummyMembraneSynth {
            triggerAttackRelease(note, duration, time, velocity) {
                this.triggeredNote = note;
            }
        }
        engine.Tone = { MembraneSynth: DummyMembraneSynth };

        const drumInstrument = new DummyMembraneSynth();
        engine.instruments.set('drums', drumInstrument);

        engine.triggerDrum('kick', 0);
        assert.equal(drumInstrument.triggeredNote, 'C2');

        engine.triggerDrum('snare', 0);
        assert.equal(drumInstrument.triggeredNote, 'D2');

        engine.triggerDrum('hat', 0);
        assert.equal(drumInstrument.triggeredNote, 'F#2');
    });

    test('setBpm correctly clamps and sets BPM', () => {
        const engine = new AudioEngine();
        let currentBpm = 120;
        engine.Tone = {
            getTransport: () => ({
                bpm: {
                    set value(v) { currentBpm = v; }
                }
            })
        };

        engine.setBpm(130);
        assert.equal(currentBpm, 130);

        engine.setBpm(200); // clamped to 180
        assert.equal(currentBpm, 180);

        engine.setBpm(30); // clamped to 50
        assert.equal(currentBpm, 50);

        engine.setBpm("100"); // works with strings
        assert.equal(currentBpm, 100);

        engine.setBpm(null); // falls back to 100 on invalid numbers that parse to 0
        assert.equal(currentBpm, 100);
    });

    test('stopAll works correctly', () => {
        const engine = new AudioEngine();
        let transportStopped = false;
        let transportCanceled = false;
        let instrumentReleased = false;

        engine.Tone = {
            getTransport: () => ({
                stop: () => { transportStopped = true; },
                cancel: (v) => {
                    assert.equal(v, 0);
                    transportCanceled = true;
                }
            })
        };

        engine.instruments.set('chords', { releaseAll: () => { instrumentReleased = true; } });
        // Some might not have releaseAll
        engine.instruments.set('drums', { });

        engine.stopAll();

        assert.equal(transportStopped, true);
        assert.equal(transportCanceled, true);
        assert.equal(instrumentReleased, true);
    });

    test('stopAll gracefully handles missing Tone', () => {
        const engine = new AudioEngine();
        // Tone is null by default
        engine.stopAll(); // Should not throw
        assert.ok(true);
    });

    test('dispose cleans up resources', () => {
        const engine = new AudioEngine();
        let transportStopped = false;
        let transportCanceled = false;
        let instrumentDisposed = false;
        let gainDisposed = false;
        let masterDisposed = false;

        engine.Tone = {
            getTransport: () => ({
                stop: () => { transportStopped = true; },
                cancel: (v) => { transportCanceled = true; }
            })
        };

        engine.instruments.set('chords', { dispose: () => { instrumentDisposed = true; } });
        engine.trackGains.set('chords', { dispose: () => { gainDisposed = true; } });
        engine.master = { dispose: () => { masterDisposed = true; } };

        engine.dispose();

        assert.equal(transportStopped, true);
        assert.equal(transportCanceled, true);
        assert.equal(instrumentDisposed, true);
        assert.equal(gainDisposed, true);
        assert.equal(masterDisposed, true);
        assert.equal(engine.disposed, true);
        assert.equal(engine.ready, false);
        assert.equal(engine.instruments.size, 0);
        assert.equal(engine.trackGains.size, 0);
    });
});

const SAMPLE_ROOT = "./assets/samples";
const SAMPLE_TIMEOUT_MS = 1800;

export const TRACK_CONFIG = Object.freeze({
  chords: { gainDb: -9, folder: "piano", urls: { C4: "C4.mp3", E4: "E4.mp3", G4: "G4.mp3", C5: "C5.mp3" } },
  bass: { gainDb: -10, folder: "bass", urls: { E2: "E2.mp3", A2: "A2.mp3", C3: "C3.mp3" } },
  melody: { gainDb: -12, folder: "guitar", urls: { C4: "C4.mp3", E4: "E4.mp3", G4: "G4.mp3", C5: "C5.mp3" } },
  drums: { gainDb: -10, folder: "drums", urls: { C2: "kick.mp3", D2: "snare.mp3", "F#2": "hihat.mp3" } }
});
const DRUM_MIDI = Object.freeze({ kick: 36, snare: 38, hat: 42 });
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function midiToNoteName(midi) { return `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`; }
async function importTone() { return import("https://cdn.jsdelivr.net/npm/tone@15.1.22/+esm"); }

export class AudioEngine {
  constructor() {
    this.ready = false;
    this.disposed = false;
    this.initializing = null;
    this.Tone = null;
    this.instruments = new Map();
    this.trackGains = new Map();
    this.trackMuted = new Map(Object.keys(TRACK_CONFIG).map((track) => [track, false]));
    this.master = null;
  }

  async unlock() {
    if (this.ready && this.Tone?.context.state === "running") return true;
    if (this.initializing) return this.initializing;
    this.initializing = (async () => {
      let Tone;
      try { Tone = await importTone(); } catch (error) { throw new Error("Tone.js could not load. Check that Safari is online and reload the page."); }
      this.Tone = Tone;
      await Tone.start();
      if (Tone.context.state !== "running") throw new Error("Safari audio context is still suspended. Tap Enable Audio again.");
      this.master = new Tone.Limiter(-1.5).toDestination();
      this.master.volume.value = -1;
      this.#buildFallbackInstruments();
      this.ready = true;
      void this.#upgradeToSamplers();
      return true;
    })().finally(() => { this.initializing = null; });
    return this.initializing;
  }

  #makeGain(track) {
    const Tone = this.Tone;
    const gain = new Tone.Gain(Tone.dbToGain(TRACK_CONFIG[track].gainDb));
    gain.connect(this.master);
    this.trackGains.set(track, gain);
    return gain;
  }
  #buildFallbackInstruments() {
    if (this.instruments.size) return;
    const Tone = this.Tone;
    const fallback = {
      chords: new Tone.PolySynth(Tone.Synth, { oscillator: { type: "triangle" }, envelope: { attack: 0.01, decay: 0.15, sustain: 0.45, release: 0.35 } }),
      bass: new Tone.MonoSynth({ oscillator: { type: "square" }, envelope: { attack: 0.005, decay: 0.12, sustain: 0.35, release: 0.2 }, filterEnvelope: { attack: 0.005, decay: 0.1, sustain: 0.3, release: 0.2, baseFrequency: 90, octaves: 2 } }),
      melody: new Tone.PolySynth(Tone.Synth, { oscillator: { type: "sine" }, envelope: { attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.25 } }),
      drums: new Tone.MembraneSynth({ pitchDecay: 0.02, octaves: 4, envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.08 } })
    };
    for (const [track, instrument] of Object.entries(fallback)) { instrument.connect(this.#makeGain(track)); this.instruments.set(track, instrument); }
  }
  async #upgradeToSamplers() {
    // Samples are optional. Missing sample assets never block playback/UI.
    const Tone = this.Tone;
    for (const [track, config] of Object.entries(TRACK_CONFIG)) {
      const urls = Object.fromEntries(Object.entries(config.urls).map(([note, file]) => [note, `${SAMPLE_ROOT}/${config.folder}/${file}`]));
      try {
        const sampler = new Tone.Sampler({ urls, release: 0.25 });
        sampler.connect(this.trackGains.get(track));
        await Promise.race([Tone.loaded(), new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), SAMPLE_TIMEOUT_MS))]);
        if (this.disposed) { sampler.dispose(); return; }
        const previous = this.instruments.get(track); this.instruments.set(track, sampler); previous?.dispose();
      } catch { /* keep fallback */ }
    }
  }
  setMute(track, muted) { this.trackMuted.set(track, muted); const gain = this.trackGains.get(track); if (gain) gain.mute = muted; }
  isMuted(track) { return this.trackMuted.get(track) === true; }
  triggerChord(notes, time, duration = "1m", velocity = 0.55) { if (this.ready && !this.isMuted("chords")) this.instruments.get("chords")?.triggerAttackRelease(notes, duration, time, velocity); }
  triggerBass(note, time, duration = "4n", velocity = 0.62) { if (this.ready && !this.isMuted("bass")) this.instruments.get("bass")?.triggerAttackRelease(note, duration, time, velocity); }
  triggerMelody(note, time, duration = "8n", velocity = 0.42) { if (this.ready && !this.isMuted("melody")) this.instruments.get("melody")?.triggerAttackRelease(note, duration, time, velocity); }
  triggerDrum(kind, time, velocity = 0.65) {
    if (!this.ready || this.isMuted("drums")) return;
    const midi = DRUM_MIDI[kind]; const instrument = this.instruments.get("drums");
    if (instrument instanceof this.Tone.MembraneSynth) instrument.triggerAttackRelease(kind === "kick" ? "C2" : kind === "snare" ? "D2" : "F#2", "16n", time, velocity);
    else instrument?.triggerAttackRelease(midiToNoteName(midi), "16n", time, velocity);
  }
  setBpm(bpm) { if (this.Tone) this.Tone.getTransport().bpm.value = Math.min(180, Math.max(50, Number(bpm) || 100)); }
  stopAll() { if (!this.Tone) return; const transport = this.Tone.getTransport(); transport.stop(); transport.cancel(0); for (const instrument of this.instruments.values()) instrument.releaseAll?.(); }
  dispose() { this.stopAll(); for (const instrument of this.instruments.values()) instrument.dispose(); for (const gain of this.trackGains.values()) gain.dispose(); this.master?.dispose(); this.instruments.clear(); this.trackGains.clear(); this.disposed = true; this.ready = false; }
}

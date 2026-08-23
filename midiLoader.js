let MidiClassPromise = null;
function loadMidiClass() {
  if (!MidiClassPromise) MidiClassPromise = import("https://cdn.jsdelivr.net/npm/@tonejs/midi@2.0.28/+esm").then((m) => m.Midi);
  return MidiClassPromise;
}

export function attachMidiFileInput(input, onLoaded, onError) {
  if (!input) return;
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const Midi = await loadMidiClass();
      const midi = new Midi(buffer);
      const notes = [];
      midi.tracks.forEach((track, trackIndex) => track.notes.forEach((note) => notes.push({ trackIndex, channel: track.channel, name: note.name, midi: note.midi, time: note.time, duration: note.duration, velocity: note.velocity })));
      onLoaded({ header: { bpm: midi.header.tempos?.[0]?.bpm ?? 120, timeSignature: midi.header.timeSignatures?.[0]?.timeSignature ?? [4, 4] }, tracks: midi.tracks, notes });
    } catch (error) { onError(error); }
  }, { passive: true });
}

export function midiToArrangementQueue(parsed, targetTrack = "melody") {
  void targetTrack;
  return [...(parsed?.notes ?? [])].sort((a, b) => a.time - b.time).map((note) => ({ time: note.time, duration: note.duration, midi: note.midi, velocity: note.velocity }));
}

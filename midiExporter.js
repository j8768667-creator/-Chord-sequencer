async function loadMidiClass() {
  const mod = await import("https://cdn.jsdelivr.net/npm/@tonejs/midi@2.0.28/+esm");
  return mod.Midi;
}

export async function buildMultitrackMidi(options) {
  const Midi = await loadMidiClass();
  const midi = new Midi();
  midi.header.setTempo(options.bpm ?? 120);
  const definitions = [
    ["chords", 0, 0],
    ["bass", 33, 1],
    ["melody", 24, 2],
    ["drums", 0, 9]
  ];
  for (const [name, program, channel] of definitions) {
    const track = midi.addTrack();
    track.channel = channel;
    if (channel !== 9) track.instrument.number = program;
    for (const event of options.tracks?.[name] ?? []) track.addNote({ midi: event.midi, time: event.time, duration: event.duration, velocity: event.velocity });
  }
  return midi;
}

export function downloadMidi(midi, filename = "chordflow.mid") {
  const bytes = midi.toArray();
  const blob = new Blob([bytes], { type: "audio/midi" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = filename; anchor.rel = "noopener";
  document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

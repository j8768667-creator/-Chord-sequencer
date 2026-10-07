import { AudioEngine } from "./audioEngine.js";
import {
  CHORD_PROGRESSIONS,
  progressionForGenre,
  randomProgression,
  chordNotesAtOctave,
} from "./chordRepository.js";
import { attachMidiFileInput, midiToArrangementQueue } from "./midiLoader.js";
import { buildMultitrackMidi, downloadMidi } from "./midiExporter.js";

const state = {
  key: "C major",
  genre: "pop",
  bpm: 100,
  progression: null,
  blocks: [],
  activeBlockIndex: 0,
  importedNotes: [],
  schedulerLoop: null,
  currentBarIndex: 0,
  trackEvents: {
    chords: [],
    bass: [],
    melody: [],
    drums: [],
  },
};

const audio = new AudioEngine();
const getTone = () => audio.Tone;

const $ = (selector) => document.querySelector(selector);
const app = $("#app");
const audioStatus = $("#audioStatus");
const transportStatus = $("#transportStatus");
const progressionGrid = $("#progressionGrid");
const blockGrid = $("#blockGrid");
const importStatus = $("#importStatus");
const playButton = $("#playButton");
const stopButton = $("#stopButton");
const unlockButton = $("#unlockButton");
const exportButton = $("#exportButton");
const randomizeButton = $("#randomizeButton");
const keySelect = $("#keySelect");
const genreSelect = $("#genreSelect");
const bpmRange = $("#bpmRange");
const bpmValue = $("#bpmValue");

function setStatus(text, running = false) {
  audioStatus.textContent = text;
  transportStatus.textContent = running ? "Playing" : "Stopped";
}

function updateViewportHeight() {
  // iPad Safari's visual viewport changes when browser chrome appears/disappears.
  // Keep CSS height stable without using 100vh.
  const viewport = window.visualViewport;
  const height = Math.round(viewport?.height || window.innerHeight);
  document.documentElement.style.setProperty("--app-height", `${height}px`);
}

function installIpadViewportSafeguards() {
  updateViewportHeight();

  window.visualViewport?.addEventListener("resize", updateViewportHeight, { passive: true });
  window.visualViewport?.addEventListener("scroll", updateViewportHeight, { passive: true });
  window.addEventListener("orientationchange", () => {
    window.setTimeout(updateViewportHeight, 100);
  }, { passive: true });

  // Prevent Safari gesture navigation/zoom from hijacking the sequencer canvas.
  app.addEventListener("gesturestart", (event) => event.preventDefault(), { passive: false });
  app.addEventListener("gesturechange", (event) => event.preventDefault(), { passive: false });
  app.addEventListener("gestureend", (event) => event.preventDefault(), { passive: false });
}

async function unlockAudioFromGesture() {
  if (audio.ready && getTone()?.context.state === "running") return true;

  try {
    unlockButton.disabled = true;
    audioStatus.textContent = "Unlocking…";
    await audio.unlock();

    if (getTone()?.context.state !== "running") {
      throw new Error("Safari audio context remains suspended.");
    }

    unlockButton.textContent = "Audio Ready";
    playButton.disabled = false;
    stopButton.disabled = false;
    randomizeButton.disabled = false;
    setStatus("Audio ready", false);
    return true;
  } catch (error) {
    console.error(error);
    audioStatus.textContent = "Audio unavailable — tap again";
    importStatus.textContent = error?.message || "Audio could not be started on this device.";
    unlockButton.disabled = false;
    return false;
  }
}

function installAudioUnlockLayer() {
  // Only the explicit button performs the potentially expensive audio unlock.
  // Unlocking on every pointerdown can create concurrent Tone.start()/sample-load
  // operations on iPad Safari and make the tab unresponsive.
  unlockButton.addEventListener("click", () => { void unlockAudioFromGesture(); });
}

function renderProgressionLibrary() {
  progressionGrid.replaceChildren();

  const catalog = CHORD_PROGRESSIONS[state.genre] ?? CHORD_PROGRESSIONS.pop;

  catalog.forEach((romanNumerals, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "progression-card";
    button.disabled = false;

    const title = document.createElement("strong");
    title.textContent = `Pattern ${index + 1}`;

    const detail = document.createElement("small");
    detail.textContent = romanNumerals.join(" · ");

    button.append(title, detail);
    button.addEventListener("click", () => {
      loadProgression(progressionForGenre(state.genre, state.key, index));
    }, { passive: true });

    progressionGrid.append(button);
  });
}

function loadProgression(progression) {
  state.progression = progression;
  state.blocks = progression.romanNumerals.map((roman, index) => ({
    id: `${Date.now()}-${index}`,
    roman,
    chord: progression.chords[index]?.symbol ?? roman,
  }));
  state.activeBlockIndex = 0;
  rebuildRuntimeEvents();
  renderBlocks();
}

function renderBlocks() {
  blockGrid.replaceChildren();

  state.blocks.forEach((block, index) => {
    const tile = document.createElement("article");
    tile.className = `block-tile${index === state.activeBlockIndex ? " active" : ""}`;
    tile.setAttribute("role", "listitem");
    tile.dataset.index = String(index);

    const number = document.createElement("span");
    number.className = "block-number";
    number.textContent = `Bar ${index + 1}`;

    const roman = document.createElement("span");
    roman.className = "block-roman";
    roman.textContent = block.roman;

    const chord = document.createElement("span");
    chord.className = "block-chord";
    chord.textContent = block.chord;

    const actions = document.createElement("div");
    actions.className = "block-actions";

    const left = document.createElement("button");
    left.type = "button";
    left.textContent = "←";
    left.setAttribute("aria-label", `Move bar ${index + 1} left`);
    left.disabled = index === 0;
    left.addEventListener("click", () => moveBlock(index, -1), { passive: true });

    const right = document.createElement("button");
    right.type = "button";
    right.textContent = "→";
    right.setAttribute("aria-label", `Move bar ${index + 1} right`);
    right.disabled = index === state.blocks.length - 1;
    right.addEventListener("click", () => moveBlock(index, 1), { passive: true });

    actions.append(left, right);
    tile.append(number, roman, chord, actions);

    tile.addEventListener("click", (event) => {
      if (event.target instanceof HTMLButtonElement) return;
      state.activeBlockIndex = index;
      renderBlocks();
    }, { passive: true });

    blockGrid.append(tile);
  });
}

function moveBlock(index, direction) {
  const target = index + direction;
  if (target < 0 || target >= state.blocks.length) return;

  [state.blocks[index], state.blocks[target]] = [state.blocks[target], state.blocks[index]];
  state.activeBlockIndex = target;
  rebuildRuntimeEvents();
  renderBlocks();
}

function getChordNotesForBlock(block) {
  const numerals = [block.roman];
  return chordNotesAtOctave(numerals, state.key, 4)[0]?.notes ?? [];
}

function randomMelodyEvents(chordNotes, barIndex, secondsPerBar) {
  const events = [];
  const grid = 8;

  for (let step = 0; step < grid; step += 1) {
    if (Math.random() < 0.30) continue;

    const source = chordNotes[Math.floor(Math.random() * chordNotes.length)];
    if (!source) continue;

    const note = source.replace(/(-?\d+)$/, (_, octave) => {
      const targetOctave = 4 + Math.floor(Math.random() * 2);
      return String(targetOctave);
    });

    events.push({
      time: barIndex * secondsPerBar + (step * secondsPerBar) / grid,
      duration: Math.max(0.08, secondsPerBar / 8 * 0.7),
      note,
      velocity: 0.35 + Math.random() * 0.2,
    });
  }

  return events;
}

function rebuildRuntimeEvents() {
  const secondsPerBeat = 60 / state.bpm;
  const secondsPerBar = secondsPerBeat * 4;

  state.trackEvents = {
    chords: [],
    bass: [],
    melody: [],
    drums: [],
  };

  state.blocks.forEach((block, barIndex) => {
    const barStart = barIndex * secondsPerBar;
    const chordNotes = getChordNotesForBlock(block);
    const root = chordNotes[0] ?? "C4";
    const bassRoot = root.replace(/(-?\d+)$/, "2");

    state.trackEvents.chords.push({
      time: barStart,
      duration: secondsPerBar,
      notes: chordNotes,
      velocity: 0.45,
    });

    if (state.genre === "orchestral" || state.genre === "soundtrack") {
      state.trackEvents.bass.push({
        time: barStart,
        duration: secondsPerBar,
        note: bassRoot,
        velocity: 0.45,
      });
    } else if (state.genre === "rock") {
      for (let step = 0; step < 8; step += 1) {
        state.trackEvents.bass.push({
          time: barStart + (step * secondsPerBar) / 8,
          duration: secondsPerBar / 10,
          note: bassRoot,
          velocity: step % 2 ? 0.5 : 0.62,
        });
      }
    } else {
      for (let beat = 0; beat < 4; beat += 1) {
        state.trackEvents.bass.push({
          time: barStart + beat * secondsPerBeat,
          duration: secondsPerBeat * 0.8,
          note: bassRoot,
          velocity: 0.55,
        });
      }
    }

    state.trackEvents.melody.push(
      ...randomMelodyEvents(chordNotes, barIndex, secondsPerBar),
    );

    const kickSteps = state.genre === "hiphop" ? [0, 3] : [0, 1, 2, 3];
    kickSteps.forEach((beat) => {
      state.trackEvents.drums.push({
        time: barStart + beat * secondsPerBeat,
        kind: "kick",
        velocity: 0.58,
      });
    });

    if (state.genre === "rock" || state.genre === "pop") {
      for (let step = 0; step < 8; step += 1) {
        state.trackEvents.drums.push({
          time: barStart + (step * secondsPerBar) / 8,
          kind: "hat",
          velocity: 0.38,
        });
      }
    } else if (state.genre === "hiphop") {
      state.trackEvents.drums.push(
        { time: barStart + secondsPerBeat, kind: "snare", velocity: 0.55 },
        { time: barStart + secondsPerBeat * 3, kind: "snare", velocity: 0.58 },
        { time: barStart + secondsPerBeat * 0.5, kind: "hat", velocity: 0.35 },
        { time: barStart + secondsPerBeat * 1.5, kind: "hat", velocity: 0.32 },
        { time: barStart + secondsPerBeat * 2.5, kind: "hat", velocity: 0.35 },
        { time: barStart + secondsPerBeat * 3.5, kind: "hat", velocity: 0.32 },
      );
    }
  });

  // Imported MIDI replaces the melody queue without destroying the generated
  // chord/bass/drum arrangement.
  if (state.importedNotes.length) {
    state.trackEvents.melody = state.importedNotes.map((note) => ({
      time: note.time,
      duration: note.duration,
      midi: note.midi,
      velocity: note.velocity,
    }));
  }
}

function scheduleCurrentArrangement() {
  if (!audio.ready || getTone()?.context.state !== "running" || state.blocks.length === 0) return;

  getTone()?.getTransport().stop();
  getTone()?.getTransport().cancel(0);

  if (state.schedulerLoop) {
    state.schedulerLoop.dispose();
    state.schedulerLoop = null;
  }

  getTone()?.getTransport().bpm.value = state.bpm;
  state.currentBarIndex = 0;

  const totalBars = Math.max(1, state.blocks.length);
  const secondsPerBar = (60 / state.bpm) * 4;
  const totalSeconds = secondsPerBar * totalBars;

  const bucketedBass = Array.from({ length: totalBars }, () => []);
  const bucketedMelody = Array.from({ length: totalBars }, () => []);
  const bucketedDrums = Array.from({ length: totalBars }, () => []);

  for (const event of state.trackEvents.bass) {
    const idx = Math.floor(event.time / secondsPerBar);
    if (idx >= 0 && idx < totalBars) bucketedBass[idx].push(event);
  }
  for (const event of state.trackEvents.melody) {
    const idx = Math.floor(event.time / secondsPerBar);
    if (idx >= 0 && idx < totalBars) bucketedMelody[idx].push(event);
  }
  for (const event of state.trackEvents.drums) {
    const idx = Math.floor(event.time / secondsPerBar);
    if (idx >= 0 && idx < totalBars) bucketedDrums[idx].push(event);
  }

  // Uniform one-measure scheduler. It uses Tone's Web Audio clock instead of
  // requestAnimationFrame, reducing CPU wakeups on iPadOS.
  state.schedulerLoop = new (getTone().Loop)((time) => {
    const barIndex = state.currentBarIndex % totalBars;
    const barStart = barIndex * secondsPerBar;

    const chord = state.trackEvents.chords[barIndex];
    if (chord) {
      audio.triggerChord(chord.notes, time, "1m", chord.velocity);
    }

    for (const event of bucketedBass[barIndex]) {
      audio.triggerBass(
        event.note,
        time + (event.time - barStart),
        event.duration,
        event.velocity,
      );
    }

    for (const event of bucketedMelody[barIndex]) {
      const note = event.note ?? getTone()?.Frequency(event.midi, "midi").toNote();
      audio.triggerMelody(
        note,
        time + (event.time - barStart),
        event.duration,
        event.velocity,
      );
    }

    for (const event of bucketedDrums[barIndex]) {
      audio.triggerDrum(
        event.kind,
        time + (event.time - barStart),
        event.velocity,
      );
    }

    state.activeBlockIndex = barIndex;
    state.currentBarIndex = (state.currentBarIndex + 1) % totalBars;
  }, "1m");

  state.schedulerLoop.start(0);

  getTone()?.getTransport().scheduleOnce(() => {
    stopTransport();
  }, totalSeconds);

  getTone()?.getTransport().start("+0.05");
  setStatus("Audio ready", true);
}

function startTransport() {
  if (!audio.ready || getTone()?.context.state !== "running") {
    void unlockAudioFromGesture();
    return;
  }

  rebuildRuntimeEvents();
  scheduleCurrentArrangement();
}

function stopTransport() {
  getTone()?.getTransport().stop();
  getTone()?.getTransport().cancel(0);
  if (state.schedulerLoop) {
    state.schedulerLoop.dispose();
    state.schedulerLoop = null;
  }
  audio.stopAll();
  setStatus("Audio ready", false);
  state.activeBlockIndex = 0;
  renderBlocks();
}

function handleImportedMidi(parsed) {
  state.importedNotes = midiToArrangementQueue(parsed, "melody");
  if (parsed.header.bpm) {
    state.bpm = Math.min(180, Math.max(50, Math.round(parsed.header.bpm)));
    bpmRange.value = String(state.bpm);
    bpmValue.value = String(state.bpm);
    audio.setBpm(state.bpm);
  }
  rebuildRuntimeEvents();
  importStatus.textContent = `Imported ${parsed.notes.length} notes across ${parsed.tracks.length} tracks. Melody playback now follows the MIDI queue.`;
}

async function exportArrangement() {
  if (!state.blocks.length) {
    importStatus.textContent = "Add a progression before exporting.";
    return;
  }
  try {
  const midi = await buildMultitrackMidi({
    bpm: state.bpm,
    tracks: {
      chords: state.trackEvents.chords.flatMap((event) =>
        event.notes.map((note) => ({
          midi: getTone()?.Frequency(note).toMidi(),
          time: event.time,
          duration: event.duration,
          velocity: event.velocity,
        })),
      ),
      bass: state.trackEvents.bass.map((event) => ({
        midi: getTone()?.Frequency(event.note).toMidi(),
        time: event.time,
        duration: event.duration,
        velocity: event.velocity,
      })),
      melody: state.trackEvents.melody.map((event) => ({
        midi: event.midi ?? getTone()?.Frequency(event.note).toMidi(),
        time: event.time,
        duration: event.duration,
        velocity: event.velocity,
      })),
      drums: state.trackEvents.drums.map((event) => ({
        midi: event.kind === "kick" ? 36 : event.kind === "snare" ? 38 : 42,
        time: event.time,
        duration: 0.08,
        velocity: event.velocity,
      })),
    },
  });

  downloadMidi(midi, `chordflow-${state.genre}-${state.key.replace(/\s+/g, "-")}.mid`);
  } catch (error) {
    importStatus.textContent = error?.message || "MIDI export could not load its MIDI engine. Check Safari internet access.";
  }
}

keySelect.addEventListener("change", () => {
  state.key = keySelect.value;
  if (state.progression) {
    loadProgression(progressionForGenre(state.genre, state.key, 0));
  }
  renderProgressionLibrary();
}, { passive: true });

genreSelect.addEventListener("change", () => {
  state.genre = genreSelect.value;
  loadProgression(progressionForGenre(state.genre, state.key, 0));
  renderProgressionLibrary();
}, { passive: true });

bpmRange.addEventListener("input", () => {
  state.bpm = Number(bpmRange.value);
  bpmValue.value = String(state.bpm);
  audio.setBpm(state.bpm);
  rebuildRuntimeEvents();
}, { passive: true });

playButton.addEventListener("click", startTransport, { passive: true });
stopButton.addEventListener("click", stopTransport, { passive: true });
randomizeButton.addEventListener("click", () => {
  loadProgression(randomProgression(state.genre, state.key));
}, { passive: true });
exportButton.addEventListener("click", exportArrangement, { passive: true });

document.querySelectorAll(".mute-button").forEach((button) => {
  button.addEventListener("click", () => {
    const track = button.dataset.track;
    const next = !audio.isMuted(track);
    audio.setMute(track, next);
    button.textContent = next ? "Unmute" : "Mute";
    button.setAttribute("aria-pressed", String(next));
  }, { passive: true });
});

attachMidiFileInput(
  $("#midiInput"),
  handleImportedMidi,
  (error) => {
    console.error(error);
    importStatus.textContent = error.message || "Could not import MIDI.";
  },
);

window.addEventListener("error", (event) => { console.error(event.error || event.message); });
window.addEventListener("unhandledrejection", (event) => { console.error(event.reason); });

installIpadViewportSafeguards();
installAudioUnlockLayer();
renderProgressionLibrary();
loadProgression(progressionForGenre(state.genre, state.key, 0));

// Service worker intentionally disabled during development; stale Safari caches can
// otherwise keep an older module graph alive after an update.

window.addEventListener("pagehide", () => {
  audio.stopAll();
}, { passive: true });

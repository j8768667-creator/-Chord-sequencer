/**
 * ChordFlow chord repository.
 *
 * The catalog is deliberately dependency-free so the preset library can render
 * even when Safari temporarily cannot reach a CDN. Tonal is loaded lazily by
 * parseWithTonal() when available; the local Roman-numeral parser is the
 * deterministic fallback used by the app itself.
 */
export const CHORD_PROGRESSIONS = Object.freeze({
  pop: Object.freeze([Object.freeze(["I", "V", "vi", "IV"]), Object.freeze(["vi", "IV", "I", "V"]), Object.freeze(["I", "vi", "IV", "V"])]),
  rock: Object.freeze([Object.freeze(["I", "bVII", "IV", "I"]), Object.freeze(["I", "IV", "V", "IV"]), Object.freeze(["i", "bVI", "bVII", "i"])]),
  country: Object.freeze([Object.freeze(["I", "IV", "V", "I"]), Object.freeze(["I", "V", "vi", "IV"]), Object.freeze(["I", "vi", "IV", "V"])]),
  hiphop: Object.freeze([Object.freeze(["i", "bVI", "bIII", "bVII"]), Object.freeze(["i", "iv", "bVI", "V"]), Object.freeze(["i", "bVII", "bVI", "bVII"])]),
  orchestral: Object.freeze([Object.freeze(["i", "bVI", "iv", "V"]), Object.freeze(["I", "IV", "vi", "V"]), Object.freeze(["i", "bIII", "bVI", "V"])]),
  soundtrack: Object.freeze([Object.freeze(["i", "bVI", "bIII", "bVII"]), Object.freeze(["vi", "IV", "I", "V"]), Object.freeze(["i", "iv", "bVII", "III"])])
});

const NOTE_PCS = { C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11 };
const PC_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const SCALE_MAJOR = [0, 2, 4, 5, 7, 9, 11];
const SCALE_MINOR = [0, 2, 3, 5, 7, 8, 10];
const DEGREE_INDEX = { I: 0, II: 1, III: 2, IV: 3, V: 4, VI: 5, VII: 6 };

export function parseKey(keyConfig = "C major") {
  const match = String(keyConfig).trim().match(/^([A-Ga-g])([#b]?)[ ]+(major|minor)$/i);
  if (!match) throw new Error(`Invalid key configuration: ${keyConfig}`);
  const tonic = `${match[1].toUpperCase()}${match[2] || ""}`;
  return { tonic, mode: match[3].toLowerCase(), label: `${tonic} ${match[3].toLowerCase()}` };
}

function romanParts(numeral) {
  const match = String(numeral).replace(/♭/g, "b").replace(/♯/g, "#").match(/^([b#]*)([ivIV]+)(.*)$/);
  if (!match) throw new Error(`Unsupported Roman numeral: ${numeral}`);
  const degree = match[2].toUpperCase();
  if (!(degree in DEGREE_INDEX)) throw new Error(`Unsupported Roman degree: ${numeral}`);
  return { accidental: match[1], degree, suffix: match[3], minor: match[2] === match[2].toLowerCase() };
}

function accidentalOffset(text) { return [...text].reduce((n, c) => n + (c === "b" ? -1 : 1), 0); }
function midiName(pc, octave) { return `${PC_NAMES[(pc + 120) % 12]}${octave}`; }

function localRomanToChord(numeral, rootKey) {
  const { tonic, mode } = parseKey(rootKey);
  const tonicPc = NOTE_PCS[tonic];
  const scale = mode === "minor" ? SCALE_MINOR : SCALE_MAJOR;
  const parts = romanParts(numeral);
  const degree = DEGREE_INDEX[parts.degree];
  const rootPc = (tonicPc + scale[degree] + accidentalOffset(parts.accidental) + 120) % 12;
  const isMinor = parts.minor;
  const suffix = parts.suffix;
  let intervals = isMinor ? [0, 3, 7] : [0, 4, 7];
  if (/dim/i.test(suffix)) intervals = [0, 3, 6];
  if (/aug/i.test(suffix)) intervals = [0, 4, 8];
  if (/7/.test(suffix)) intervals = [...intervals, isMinor ? 10 : 10];
  if (/maj7/i.test(suffix)) intervals = [0, 4, 7, 11];
  return {
    symbol: `${midiName(rootPc, 3).replace(/3$/, "")}${isMinor ? "m" : ""}${suffix}`,
    notes: intervals.map((i) => PC_NAMES[(rootPc + i) % 12]),
    root: PC_NAMES[rootPc],
    quality: isMinor ? "minor" : "major"
  };
}

export function romanToChordSymbols(progression, rootKey = "C major") {
  return progression.map((numeral) => localRomanToChord(numeral, rootKey).symbol);
}

export function chordNotes(progression, rootKey = "C major") {
  return progression.map((roman, index) => {
    const parsed = localRomanToChord(roman, rootKey);
    return { index, roman, symbol: parsed.symbol, notes: parsed.notes, root: parsed.root, quality: parsed.quality };
  });
}

export function chordNotesAtOctave(progression, rootKey = "C major", octave = 4) {
  return chordNotes(progression, rootKey).map((chord) => ({ ...chord, notes: chord.notes.map((note) => `${note}${octave}`) }));
}

export function progressionForGenre(genre, rootKey = "C major", index = 0) {
  const catalog = CHORD_PROGRESSIONS[genre] ?? CHORD_PROGRESSIONS.pop;
  const selected = catalog[Math.abs(index) % catalog.length];
  return { genre, rootKey, romanNumerals: [...selected], chords: chordNotes(selected, rootKey) };
}

export function randomProgression(genre, rootKey = "C major") {
  const catalog = CHORD_PROGRESSIONS[genre] ?? CHORD_PROGRESSIONS.pop;
  return progressionForGenre(genre, rootKey, Math.floor(Math.random() * catalog.length));
}

/** Optional Tonal bridge for environments where the CDN is reachable. */
export async function parseWithTonal(progression, rootKey = "C major") {
  const { tonic } = parseKey(rootKey);
  try {
    const { Progression } = await import("https://esm.sh/@tonaljs/progression@4.10.0");
    return Progression.fromRomanNumerals(tonic, progression);
  } catch {
    return romanToChordSymbols(progression, rootKey);
  }
}

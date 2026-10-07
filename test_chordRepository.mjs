import { romanParts } from "./chordRepository.js";
import assert from "node:assert";

function runTests() {
  console.log("Running romanParts tests...");

  // Happy paths
  assert.deepStrictEqual(romanParts("I"), { accidental: "", degree: "I", suffix: "", minor: false });
  assert.deepStrictEqual(romanParts("iv"), { accidental: "", degree: "IV", suffix: "", minor: true });
  assert.deepStrictEqual(romanParts("bVII"), { accidental: "b", degree: "VII", suffix: "", minor: false });
  assert.deepStrictEqual(romanParts("#IV"), { accidental: "#", degree: "IV", suffix: "", minor: false });

  // Numerals with suffixes
  assert.deepStrictEqual(romanParts("V7"), { accidental: "", degree: "V", suffix: "7", minor: false });
  assert.deepStrictEqual(romanParts("iidim"), { accidental: "", degree: "II", suffix: "dim", minor: true });
  assert.deepStrictEqual(romanParts("Imaj7"), { accidental: "", degree: "I", suffix: "maj7", minor: false });
  assert.deepStrictEqual(romanParts("bviim7b5"), { accidental: "b", degree: "VII", suffix: "m7b5", minor: true });

  // Unicode accidentals
  assert.deepStrictEqual(romanParts("♭VII"), { accidental: "b", degree: "VII", suffix: "", minor: false });
  assert.deepStrictEqual(romanParts("♯IV"), { accidental: "#", degree: "IV", suffix: "", minor: false });

  // Invalid numerals
  assert.throws(() => romanParts("abc"), { message: "Unsupported Roman numeral: abc" });
  assert.throws(() => romanParts("123"), { message: "Unsupported Roman numeral: 123" });
  assert.throws(() => romanParts(""), { message: "Unsupported Roman numeral: " });

  // Invalid degrees
  assert.throws(() => romanParts("VIII"), { message: "Unsupported Roman degree: VIII" });
  assert.throws(() => romanParts("VIVI"), { message: "Unsupported Roman degree: VIVI" });

  console.log("All romanParts tests passed!");
}

runTests();

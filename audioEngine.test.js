import { test } from "node:test";
import assert from "node:assert";
import { AudioEngine } from "./audioEngine.js";

test("unlock throws error when Tone.js fails to load", async (t) => {
    // In Node.js, `import("https://...")` natively throws ERR_UNSUPPORTED_ESM_URL_SCHEME
    // because it doesn't support fetching from https without experimental flags.
    // This perfectly mimics a network failure in the browser for our test.
    const engine = new AudioEngine();

    // Attempting to unlock should trigger the dynamic import of Tone.js, which fails,
    // and AudioEngine should catch that and throw a specific error message.
    await assert.rejects(
        engine.unlock(),
        { message: "Tone.js could not load. Check that Safari is online and reload the page." }
    );
});

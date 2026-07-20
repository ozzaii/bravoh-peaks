import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { peaksFromWav } from "../src/wav.js";
import { expandAudioPeaks } from "../src/decode.js";

const here = dirname(fileURLToPath(import.meta.url));

// These WAV fixtures and golden receipts were produced by an INDEPENDENT
// Python reference implementation (numpy + the production DSP service). If this
// TypeScript encoder is byte-for-byte correct, every field of every receipt —
// including the base64url payload and the 8-decimal maxAmplitude — must match.
const FIXTURES = ["mono-sine", "quiet-pulses", "stereo-transients"] as const;

describe("golden parity with the Python reference", () => {
  for (const name of FIXTURES) {
    it(`reproduces ${name}.json exactly`, () => {
      const wav = readFileSync(join(here, "fixtures", `${name}.wav`));
      const golden = JSON.parse(readFileSync(join(here, "golden", `${name}.json`), "utf8"));

      const receipt = peaksFromWav(wav);

      expect(receipt).toEqual(golden);
      // The self-computed asset hash must bind the exact fixture bytes.
      expect(receipt.assetSha256).toBe(golden.assetSha256);
    });
  }

  it("decodes a golden payload back to a normalised envelope", () => {
    const golden = JSON.parse(
      readFileSync(join(here, "golden", "mono-sine.json"), "utf8"),
    );
    const values = expandAudioPeaks(golden);
    expect(values).toHaveLength(golden.bucketCount);
    expect(Math.max(...values)).toBe(1); // asset-peak normalisation → loudest bucket is 1
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
  });
});

import { describe, expect, it } from "vitest";
import { encodeAudioPeaks } from "../src/encode.js";
import { isAudioPeaks, parseAudioPeaks } from "../src/format.js";

const valid = encodeAudioPeaks([new Float32Array(1000).map((_, i) => Math.sin(i / 5))], {
  sampleRateHz: 44_100,
  assetSha256: "b".repeat(64),
});

describe("parseAudioPeaks / isAudioPeaks", () => {
  it("accepts a well-formed receipt", () => {
    expect(() => parseAudioPeaks(valid)).not.toThrow();
    expect(isAudioPeaks(valid)).toBe(true);
    expect(parseAudioPeaks(structuredClone(valid))).toEqual(valid);
  });

  it("accepts a receipt without the optional assetSha256", () => {
    const { assetSha256, ...bare } = valid;
    void assetSha256;
    expect(isAudioPeaks(bare)).toBe(true);
  });

  it("rejects non-objects and wrong tags", () => {
    for (const bad of [null, undefined, 42, "x", [], {}]) {
      expect(isAudioPeaks(bad)).toBe(false);
    }
    expect(() => parseAudioPeaks({ ...valid, version: "audio-peaks.v2" })).toThrow(/version/);
    expect(() => parseAudioPeaks({ ...valid, algorithm: "rms.v1" })).toThrow(/algorithm/);
    expect(() => parseAudioPeaks({ ...valid, encoding: "u16" })).toThrow(/encoding/);
  });

  it("rejects a payload whose length disagrees with bucketCount", () => {
    expect(() => parseAudioPeaks({ ...valid, bucketCount: valid.bucketCount + 1 })).toThrow(
      /bucketCount/,
    );
  });

  it("rejects a malformed assetSha256", () => {
    expect(() => parseAudioPeaks({ ...valid, assetSha256: "XYZ" })).toThrow(/assetSha256/);
    expect(() => parseAudioPeaks({ ...valid, assetSha256: "A".repeat(64) })).toThrow(/assetSha256/);
  });

  it("rejects out-of-range numeric fields", () => {
    expect(() => parseAudioPeaks({ ...valid, channels: 0 })).toThrow(/channels/);
    expect(() => parseAudioPeaks({ ...valid, sampleRateHz: -1 })).toThrow(/sampleRateHz/);
    expect(() => parseAudioPeaks({ ...valid, maxAmplitude: -0.1 })).toThrow(/maxAmplitude/);
  });
});

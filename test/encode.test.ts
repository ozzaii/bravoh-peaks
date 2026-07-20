import { describe, expect, it } from "vitest";
import { encodeAudioPeaks } from "../src/encode.js";
import { expandAudioPeaks } from "../src/decode.js";
import { decodeBase64Url } from "../src/base64url.js";

describe("encodeAudioPeaks — max-abs-all-channels.v1", () => {
  it("is deterministic and rounds half up (mirrors the Python reference test)", () => {
    // 385 frames, stereo: a -0.5 magnitude at 193 and a full-scale 1.0 at 384.
    const left = new Float32Array(385);
    const right = new Float32Array(385);
    right[193] = -0.5;
    left[384] = 1.0;
    const a = encodeAudioPeaks([left, right], { sampleRateHz: 44_100 });
    const b = encodeAudioPeaks([left.slice(), right.slice()], { sampleRateHz: 44_100 });
    expect(a).toEqual(b);
    expect(a.bucketCount).toBe(192);
    expect(a.channels).toBe(2);
    expect(a.frameCount).toBe(385);
    const bytes = decodeBase64Url(a.payload);
    expect(bytes).toHaveLength(192);
    expect([...bytes]).toContain(128); // 0.5 normalised, round-half-up → 128
    expect(bytes[bytes.length - 1]).toBe(255); // the 1.0 peak
  });

  it("treats silence as a measured zero envelope, not missing data", () => {
    const peaks = encodeAudioPeaks([new Float32Array(1000)], { sampleRateHz: 1000 });
    expect(peaks.maxAmplitude).toBe(0);
    expect([...decodeBase64Url(peaks.payload)]).toEqual(Array(192).fill(0));
    expect(expandAudioPeaks(peaks).every((v) => v === 0)).toBe(true);
  });

  it("clamps bucketCount to the frame count for short audio", () => {
    const peaks = encodeAudioPeaks([new Float32Array(40).fill(0.3)], {
      sampleRateHz: 8000,
      bucketCount: 192,
    });
    expect(peaks.bucketCount).toBe(40);
    expect(decodeBase64Url(peaks.payload)).toHaveLength(40);
  });

  it("takes the maximum magnitude across all channels per bucket", () => {
    const left = new Float32Array([0.2, 0.2]);
    const right = new Float32Array([0.9, 0.1]);
    const peaks = encodeAudioPeaks([left, right], { sampleRateHz: 8000, bucketCount: 2 });
    const values = expandAudioPeaks(peaks);
    // bucket 0 peak = max(0.2, 0.9) = 0.9 (asset max) → 1; bucket 1 = max(0.2,0.1)=0.2 → 0.2/0.9
    expect(values[0]).toBe(1);
    expect(values[1]).toBeCloseTo(0.2 / 0.9, 2);
  });

  it("round-trips a computed duration", () => {
    const peaks = encodeAudioPeaks([new Float32Array(48_000).fill(0.5)], { sampleRateHz: 48_000 });
    expect(peaks.durationMs).toBe(1000);
  });

  it("rejects empty audio, ragged channels, non-finite samples, and bad options", () => {
    expect(() => encodeAudioPeaks([], { sampleRateHz: 44_100 })).toThrow();
    expect(() => encodeAudioPeaks([new Float32Array(0)], { sampleRateHz: 44_100 })).toThrow();
    expect(() =>
      encodeAudioPeaks([new Float32Array(4), new Float32Array(5)], { sampleRateHz: 44_100 }),
    ).toThrow(/same length/);
    const bad = new Float32Array([0, Number.NaN]);
    expect(() => encodeAudioPeaks([bad], { sampleRateHz: 44_100 })).toThrow(/non-finite/);
    expect(() => encodeAudioPeaks([new Float32Array(4)], { sampleRateHz: 0 })).toThrow();
    expect(() =>
      encodeAudioPeaks([new Float32Array(4)], { sampleRateHz: 44_100, bucketCount: 0 }),
    ).toThrow();
    expect(() =>
      encodeAudioPeaks([new Float32Array(4)], { sampleRateHz: 44_100, assetSha256: "nope" }),
    ).toThrow(/assetSha256/);
  });

  it("carries a provided assetSha256 through", () => {
    const sha = "a".repeat(64);
    const peaks = encodeAudioPeaks([new Float32Array(8).fill(0.5)], {
      sampleRateHz: 8000,
      assetSha256: sha,
    });
    expect(peaks.assetSha256).toBe(sha);
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { decodeWav, peaksFromWav } from "../src/wav.js";

/** Build a minimal PCM/float WAV for testing the reader's branches. */
function buildWav(channels: number[][], sampleRateHz: number, format: "pcm16" | "f32"): Uint8Array {
  const frameCount = channels[0]!.length;
  const bytesPerSample = format === "f32" ? 4 : 2;
  const dataLength = frameCount * channels.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);
  const ascii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
  };
  ascii(0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, format === "f32" ? 3 : 1, true);
  view.setUint16(22, channels.length, true);
  view.setUint32(24, sampleRateHz, true);
  view.setUint32(28, sampleRateHz * channels.length * bytesPerSample, true);
  view.setUint16(32, channels.length * bytesPerSample, true);
  view.setUint16(34, bytesPerSample * 8, true);
  ascii(36, "data");
  view.setUint32(40, dataLength, true);
  let offset = 44;
  for (let frame = 0; frame < frameCount; frame += 1) {
    for (let ch = 0; ch < channels.length; ch += 1) {
      const sample = channels[ch]![frame]!;
      if (format === "f32") {
        view.setFloat32(offset, sample, true);
      } else {
        view.setInt16(offset, Math.max(-32768, Math.min(32767, Math.round(sample * 32768))), true);
      }
      offset += bytesPerSample;
    }
  }
  return new Uint8Array(buffer);
}

describe("decodeWav", () => {
  it("deinterleaves multi-channel PCM16 and normalises to [-1, 1]", () => {
    const wav = buildWav(
      [
        [0.5, -0.25, 0],
        [-0.5, 0.25, 1],
      ],
      44_100,
      "pcm16",
    );
    const decoded = decodeWav(wav);
    expect(decoded.sampleRateHz).toBe(44_100);
    expect(decoded.frameCount).toBe(3);
    expect(decoded.channels).toHaveLength(2);
    expect(decoded.channels[0]![0]).toBeCloseTo(0.5, 4);
    expect(decoded.channels[1]![0]).toBeCloseTo(-0.5, 4);
  });

  it("reads signed 24-bit extensible PCM after an odd-sized padded chunk", () => {
    const wav = readFileSync(new URL("./fixtures/extensible-pcm24.wav", import.meta.url));
    const decoded = decodeWav(wav);
    expect(decoded.sampleRateHz).toBe(48_000);
    expect(decoded.frameCount).toBe(3);
    expect(decoded.channels.map((channel) => Array.from(channel))).toEqual([
      [-1, -1 / 8388608, 0],
      [8388607 / 8388608, 1 / 8388608, -0.5],
    ]);
    const receipt = JSON.parse(readFileSync(new URL("./golden/extensible-pcm24.json", import.meta.url), "utf8"));
    expect(peaksFromWav(wav)).toEqual(receipt);
  });

  it("reads IEEE float32 WAV", () => {
    const wav = buildWav([[0.123, -0.987, 0.5]], 48_000, "f32");
    const decoded = decodeWav(wav);
    expect(decoded.sampleRateHz).toBe(48_000);
    expect(decoded.channels[0]![1]).toBeCloseTo(-0.987, 5);
  });

  it("rejects non-WAV input", () => {
    expect(() => decodeWav(new Uint8Array([1, 2, 3, 4]))).toThrow(/RIFF/);
  });

  it("peaksFromWav computes assetSha256 from the exact bytes", () => {
    const wav = buildWav([[0.5, 0.5, 0.5, 0.5]], 8000, "pcm16");
    const peaks = peaksFromWav(wav, { bucketCount: 2 });
    expect(peaks.assetSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(peaks.bucketCount).toBe(2);
    expect(peaks.sampleRateHz).toBe(8000);
  });
});

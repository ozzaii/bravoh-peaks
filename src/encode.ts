/**
 * The `max-abs-all-channels.v1` encoder.
 *
 * For each of `bucketCount` evenly-spaced windows over the frames, take the
 * maximum absolute sample across *all channels*, normalise the whole envelope
 * by the loudest bucket ("asset-peak"), quantise to `Uint8` (round-half-up),
 * and serialise as unpadded base64url. Byte-for-byte identical to the Python
 * reference used in production — see `test/parity.test.ts`.
 */

import { encodeBase64Url } from "./base64url.js";
import {
  AUDIO_PEAKS_ALGORITHM,
  AUDIO_PEAKS_VERSION,
  type AudioPeaks,
  DEFAULT_BUCKET_COUNT,
  MAX_BUCKET_COUNT,
} from "./format.js";

export interface EncodeOptions {
  /** Sample rate of the source audio, in Hz. Required for `durationMs`. */
  sampleRateHz: number;
  /** Number of peaks to emit. Clamped to the frame count. Default 192. */
  bucketCount?: number;
  /**
   * Lowercase-hex SHA-256 of the source audio bytes, if you have it. Binds the
   * receipt to an exact asset. Omit for a bare waveform.
   */
  assetSha256?: string;
}

const HEX64 = /^[a-f0-9]{64}$/;

function roundHalfUp(value: number): number {
  return Math.floor(value + 0.5);
}

/** Round a float to 8 decimal places (the receipt's `maxAmplitude` precision). */
function round8(value: number): number {
  return Math.round(value * 1e8) / 1e8;
}

/**
 * Encode decoded PCM (one `Float32Array` per channel, samples in `[-1, 1]`)
 * into an `audio-peaks.v1` receipt.
 *
 * All channels must be the same length. Throws on empty audio, a length
 * mismatch, non-finite samples, or an out-of-range option.
 */
export function encodeAudioPeaks(
  channels: ReadonlyArray<Float32Array | ReadonlyArray<number>>,
  options: EncodeOptions,
): AudioPeaks {
  if (!Array.isArray(channels) || channels.length < 1 || channels.length > 64) {
    throw new TypeError("encodeAudioPeaks: expected 1–64 channels");
  }
  const frameCount = channels[0]!.length;
  if (frameCount < 1) {
    throw new TypeError("encodeAudioPeaks: audio is empty");
  }
  for (const channel of channels) {
    if (channel.length !== frameCount) {
      throw new TypeError("encodeAudioPeaks: all channels must be the same length");
    }
  }

  const { sampleRateHz } = options;
  if (!Number.isInteger(sampleRateHz) || sampleRateHz < 1 || sampleRateHz > 384_000) {
    throw new TypeError("encodeAudioPeaks: sampleRateHz must be an integer in 1–384000");
  }
  const requested = options.bucketCount ?? DEFAULT_BUCKET_COUNT;
  if (!Number.isInteger(requested) || requested < 1 || requested > MAX_BUCKET_COUNT) {
    throw new TypeError(`encodeAudioPeaks: bucketCount must be an integer in 1–${MAX_BUCKET_COUNT}`);
  }
  if (options.assetSha256 !== undefined && !HEX64.test(options.assetSha256)) {
    throw new TypeError("encodeAudioPeaks: assetSha256 must be 64 lowercase hex chars");
  }

  const bucketCount = Math.min(requested, frameCount);
  const envelope = new Float64Array(bucketCount);
  let maxAmplitude = 0;

  for (let bucket = 0; bucket < bucketCount; bucket += 1) {
    const start = Math.floor((bucket * frameCount) / bucketCount);
    const end = Math.floor(((bucket + 1) * frameCount) / bucketCount);
    let peak = 0;
    for (let frame = start; frame < end; frame += 1) {
      for (let channel = 0; channel < channels.length; channel += 1) {
        const sample = channels[channel]![frame]!;
        if (!Number.isFinite(sample)) {
          throw new TypeError("encodeAudioPeaks: audio contains non-finite samples");
        }
        const magnitude = sample < 0 ? -sample : sample;
        if (magnitude > peak) peak = magnitude;
      }
    }
    envelope[bucket] = peak;
    if (peak > maxAmplitude) maxAmplitude = peak;
  }

  const payloadBytes = new Uint8Array(bucketCount);
  if (maxAmplitude > 0) {
    for (let bucket = 0; bucket < bucketCount; bucket += 1) {
      const quantized = roundHalfUp((envelope[bucket]! / maxAmplitude) * 255);
      payloadBytes[bucket] = quantized < 0 ? 0 : quantized > 255 ? 255 : quantized;
    }
  }

  const receipt: AudioPeaks = {
    version: AUDIO_PEAKS_VERSION,
    algorithm: AUDIO_PEAKS_ALGORITHM,
    sampleRateHz,
    channels: channels.length,
    frameCount,
    durationMs: Math.round((frameCount / sampleRateHz) * 1000),
    bucketCount,
    encoding: "u8-base64url",
    normalization: "asset-peak",
    maxAmplitude: round8(maxAmplitude),
    payload: encodeBase64Url(payloadBytes),
  };
  if (options.assetSha256 !== undefined) {
    receipt.assetSha256 = options.assetSha256;
  }
  return receipt;
}

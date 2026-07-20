/**
 * The `audio-peaks.v1` format — constants, the `AudioPeaks` type, and a strict
 * zero-dependency validator.
 *
 * A peaks receipt is self-describing: it carries the algorithm, the source
 * sample rate / channel count / frame count, the number of buckets, and the
 * `Uint8` payload as unpadded base64url. Anything reading it can render a
 * waveform without the original audio, and can prove which asset it came from
 * via the optional `assetSha256`.
 */

import { decodeBase64Url } from "./base64url.js";

export const AUDIO_PEAKS_VERSION = "audio-peaks.v1" as const;
export const AUDIO_PEAKS_ALGORITHM = "max-abs-all-channels.v1" as const;

/** Default bucket resolution — 192 evenly-spaced peaks, a good small preview. */
export const DEFAULT_BUCKET_COUNT = 192 as const;

/** Hard cap on buckets. High enough for a full-width player, bounded for sanity. */
export const MAX_BUCKET_COUNT = 100_000 as const;

/**
 * A `audio-peaks.v1` receipt.
 *
 * `assetSha256` is optional metadata: when present it is the lowercase-hex
 * SHA-256 of the *source audio bytes*, binding the peaks to an exact asset.
 */
export interface AudioPeaks {
  version: typeof AUDIO_PEAKS_VERSION;
  algorithm: typeof AUDIO_PEAKS_ALGORITHM;
  assetSha256?: string;
  sampleRateHz: number;
  channels: number;
  frameCount: number;
  durationMs: number;
  bucketCount: number;
  encoding: "u8-base64url";
  normalization: "asset-peak";
  maxAmplitude: number;
  /** Unpadded base64url of `bucketCount` `Uint8` bytes. */
  payload: string;
}

const HEX64 = /^[a-f0-9]{64}$/;
const BASE64URL = /^[A-Za-z0-9_-]*$/;

function isInt(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}

/**
 * Validate and narrow an unknown value to `AudioPeaks`, throwing `TypeError`
 * with a specific reason on the first violation. Also verifies the payload
 * decodes to exactly `bucketCount` bytes — a receipt that passes this is
 * safe to `expandAudioPeaks`.
 */
export function parseAudioPeaks(value: unknown): AudioPeaks {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("audio-peaks: not an object");
  }
  const peaks = value as Record<string, unknown>;

  if (peaks.version !== AUDIO_PEAKS_VERSION) {
    throw new TypeError(`audio-peaks: unsupported version ${String(peaks.version)}`);
  }
  if (peaks.algorithm !== AUDIO_PEAKS_ALGORITHM) {
    throw new TypeError(`audio-peaks: unsupported algorithm ${String(peaks.algorithm)}`);
  }
  if (peaks.encoding !== "u8-base64url") {
    throw new TypeError(`audio-peaks: unsupported encoding ${String(peaks.encoding)}`);
  }
  if (peaks.normalization !== "asset-peak") {
    throw new TypeError(`audio-peaks: unsupported normalization ${String(peaks.normalization)}`);
  }
  if (peaks.assetSha256 !== undefined) {
    if (typeof peaks.assetSha256 !== "string" || !HEX64.test(peaks.assetSha256)) {
      throw new TypeError("audio-peaks: assetSha256 must be 64 lowercase hex chars");
    }
  }
  if (!isInt(peaks.sampleRateHz, 1, 384_000)) {
    throw new TypeError("audio-peaks: invalid sampleRateHz");
  }
  if (!isInt(peaks.channels, 1, 64)) {
    throw new TypeError("audio-peaks: invalid channels");
  }
  if (!isInt(peaks.frameCount, 1, Number.MAX_SAFE_INTEGER)) {
    throw new TypeError("audio-peaks: invalid frameCount");
  }
  if (!isInt(peaks.durationMs, 0, Number.MAX_SAFE_INTEGER)) {
    throw new TypeError("audio-peaks: invalid durationMs");
  }
  if (!isInt(peaks.bucketCount, 1, MAX_BUCKET_COUNT)) {
    throw new TypeError("audio-peaks: invalid bucketCount");
  }
  if (
    typeof peaks.maxAmplitude !== "number" ||
    !Number.isFinite(peaks.maxAmplitude) ||
    peaks.maxAmplitude < 0
  ) {
    throw new TypeError("audio-peaks: invalid maxAmplitude");
  }
  if (typeof peaks.payload !== "string" || !BASE64URL.test(peaks.payload)) {
    throw new TypeError("audio-peaks: invalid payload");
  }
  if (decodeBase64Url(peaks.payload).length !== peaks.bucketCount) {
    throw new TypeError("audio-peaks: payload length does not match bucketCount");
  }

  return peaks as unknown as AudioPeaks;
}

/** Boolean guard — never throws. */
export function isAudioPeaks(value: unknown): value is AudioPeaks {
  try {
    parseAudioPeaks(value);
    return true;
  } catch {
    return false;
  }
}

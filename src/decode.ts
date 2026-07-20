/**
 * Decode a peaks receipt back to a normalised envelope you can draw.
 */

import { decodeBase64Url } from "./base64url.js";
import { type AudioPeaks, parseAudioPeaks } from "./format.js";

/**
 * Expand an `audio-peaks.v1` receipt to `bucketCount` values in `[0, 1]`,
 * where `1` is the loudest bucket of the source asset.
 *
 * Validates the receipt first (see {@link parseAudioPeaks}); throws `TypeError`
 * on a malformed or inconsistent receipt.
 */
export function expandAudioPeaks(peaks: AudioPeaks | unknown): number[] {
  const parsed = parseAudioPeaks(peaks);
  const bytes = decodeBase64Url(parsed.payload);
  if (bytes.length !== parsed.bucketCount) {
    throw new TypeError("audio-peaks: payload length does not match bucketCount");
  }
  const values = new Array<number>(bytes.length);
  for (let index = 0; index < bytes.length; index += 1) {
    values[index] = bytes[index]! / 255;
  }
  return values;
}

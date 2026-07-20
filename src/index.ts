/**
 * bravoh-peaks — generate, encode, decode & render SoundCloud-style waveform
 * peaks. Zero runtime dependencies; runs anywhere.
 *
 * Part of BRAVOH open source — https://github.com/ozzaii
 */

export {
  AUDIO_PEAKS_ALGORITHM,
  AUDIO_PEAKS_VERSION,
  type AudioPeaks,
  DEFAULT_BUCKET_COUNT,
  isAudioPeaks,
  MAX_BUCKET_COUNT,
  parseAudioPeaks,
} from "./format.js";
export { type EncodeOptions, encodeAudioPeaks } from "./encode.js";
export { expandAudioPeaks } from "./decode.js";
export { decodeBase64Url, encodeBase64Url } from "./base64url.js";
export { sha256Hex } from "./sha256.js";
export { type DecodedWav, decodeWav, peaksFromWav } from "./wav.js";
export { type RenderSvgOptions, renderPeaksSvg } from "./svg.js";

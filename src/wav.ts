/**
 * A small, dependency-free WAV reader — just enough to get PCM out of a file
 * and into the encoder.
 *
 * Supports uncompressed integer PCM (8/16/24/32-bit) and IEEE float
 * (32/64-bit), mono or multi-channel, including `WAVE_FORMAT_EXTENSIBLE`.
 * Samples come out as one `Float32Array` per channel, normalised to `[-1, 1]`.
 * This is deliberately not a general media decoder — for MP3/AAC/OGG, decode
 * with the platform (`AudioContext.decodeAudioData`, ffmpeg, etc.) and hand the
 * channel data to {@link encodeAudioPeaks}.
 */

import { encodeAudioPeaks, type EncodeOptions } from "./encode.js";
import { type AudioPeaks } from "./format.js";
import { sha256Hex } from "./sha256.js";

export interface DecodedWav {
  channels: Float32Array[];
  sampleRateHz: number;
  frameCount: number;
}

const FORMAT_PCM = 0x0001;
const FORMAT_FLOAT = 0x0003;
const FORMAT_EXTENSIBLE = 0xfffe;

function readFourCC(view: DataView, offset: number): string {
  return String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3),
  );
}

/** Decode an uncompressed WAV file to normalised per-channel `Float32Array`s. */
export function decodeWav(input: Uint8Array | ArrayBuffer): DecodedWav {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  if (bytes.byteLength < 12 || readFourCC(view, 0) !== "RIFF" || readFourCC(view, 8) !== "WAVE") {
    throw new TypeError("decodeWav: not a RIFF/WAVE file");
  }

  let formatCode = 0;
  let channels = 0;
  let sampleRateHz = 0;
  let bitsPerSample = 0;
  let dataOffset = -1;
  let dataLength = 0;

  let offset = 12;
  while (offset + 8 <= bytes.byteLength) {
    const chunkId = readFourCC(view, offset);
    const chunkSize = view.getUint32(offset + 4, true);
    const body = offset + 8;
    if (chunkId === "fmt ") {
      formatCode = view.getUint16(body, true);
      channels = view.getUint16(body + 2, true);
      sampleRateHz = view.getUint32(body + 4, true);
      bitsPerSample = view.getUint16(body + 14, true);
      if (formatCode === FORMAT_EXTENSIBLE && chunkSize >= 26) {
        formatCode = view.getUint16(body + 24, true); // subformat's first word
      }
    } else if (chunkId === "data") {
      dataOffset = body;
      dataLength = Math.min(chunkSize, bytes.byteLength - body);
    }
    offset = body + chunkSize + (chunkSize & 1); // chunks are word-aligned
  }

  if (channels < 1 || channels > 64) throw new TypeError("decodeWav: unsupported channel count");
  if (sampleRateHz < 1) throw new TypeError("decodeWav: missing sample rate");
  if (dataOffset < 0) throw new TypeError("decodeWav: no data chunk");

  const bytesPerSample = bitsPerSample >> 3;
  if (bytesPerSample < 1) throw new TypeError("decodeWav: unsupported bit depth");
  const frameSize = bytesPerSample * channels;
  const frameCount = Math.floor(dataLength / frameSize);
  if (frameCount < 1) throw new TypeError("decodeWav: empty data chunk");

  const out: Float32Array[] = [];
  for (let channel = 0; channel < channels; channel += 1) out.push(new Float32Array(frameCount));

  const readSample = sampleReader(view, formatCode, bitsPerSample);
  for (let frame = 0; frame < frameCount; frame += 1) {
    const base = dataOffset + frame * frameSize;
    for (let channel = 0; channel < channels; channel += 1) {
      out[channel]![frame] = readSample(base + channel * bytesPerSample);
    }
  }

  return { channels: out, sampleRateHz, frameCount };
}

function sampleReader(
  view: DataView,
  formatCode: number,
  bitsPerSample: number,
): (byteOffset: number) => number {
  if (formatCode === FORMAT_FLOAT) {
    if (bitsPerSample === 32) return (o) => view.getFloat32(o, true);
    if (bitsPerSample === 64) return (o) => view.getFloat64(o, true);
    throw new TypeError("decodeWav: unsupported float bit depth");
  }
  if (formatCode === FORMAT_PCM) {
    if (bitsPerSample === 8) return (o) => (view.getUint8(o) - 128) / 128; // unsigned
    if (bitsPerSample === 16) return (o) => view.getInt16(o, true) / 32768;
    if (bitsPerSample === 24) {
      return (o) => {
        const raw = view.getUint8(o) | (view.getUint8(o + 1) << 8) | (view.getUint8(o + 2) << 16);
        const signed = raw & 0x800000 ? raw - 0x1000000 : raw;
        return signed / 8388608;
      };
    }
    if (bitsPerSample === 32) return (o) => view.getInt32(o, true) / 2147483648;
    throw new TypeError("decodeWav: unsupported PCM bit depth");
  }
  throw new TypeError(`decodeWav: unsupported WAV format 0x${formatCode.toString(16)}`);
}

/**
 * One-call convenience: decode a WAV file's bytes and encode its peaks, with
 * `assetSha256` computed from the exact input bytes. `sampleRateHz` is read
 * from the file, so only `bucketCount` is worth passing.
 */
export function peaksFromWav(
  input: Uint8Array | ArrayBuffer,
  options: Omit<EncodeOptions, "sampleRateHz"> = {},
): AudioPeaks {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const { channels, sampleRateHz } = decodeWav(bytes);
  return encodeAudioPeaks(channels, {
    sampleRateHz,
    bucketCount: options.bucketCount,
    assetSha256: options.assetSha256 ?? sha256Hex(bytes),
  });
}

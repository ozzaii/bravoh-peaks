# Changelog

## 0.1.0

First public release. Extracted from BRAVOH's production music-AI app.

- `encodeAudioPeaks` — canonical `max-abs-all-channels.v1` encoder over decoded PCM.
- `expandAudioPeaks` / `parseAudioPeaks` / `isAudioPeaks` — strict, zero-dependency decode and validation.
- `peaksFromWav` + `decodeWav` — minimal WAV reader (8/16/24/32-bit PCM and IEEE float, mono/multi-channel) with automatic `assetSha256`.
- `renderPeaksSvg` — standalone SVG waveform renderer (`mirror`, `bars`, `line`).
- `encodeBase64Url` / `decodeBase64Url` — strict unpadded base64url primitive.
- `sha256Hex` — dependency-free synchronous SHA-256.
- `bravoh-peaks` CLI — `npx bravoh-peaks track.wav [--buckets N] [--svg out.svg]`.
- Byte-for-byte golden parity with the independent Python reference; 32 tests.

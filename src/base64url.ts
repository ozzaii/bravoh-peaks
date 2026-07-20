/**
 * Unpadded base64url codec — zero dependencies, no `Buffer` / `atob` / `btoa`.
 *
 * The waveform payload is a run of `Uint8` bytes serialised as canonical,
 * unpadded base64url (RFC 4648 §5 alphabet, `=` padding stripped). Decoding is
 * strict: it rejects padding, non-alphabet characters, and any input whose
 * trailing bits are not zero — so a payload round-trips to exactly the bytes it
 * came from, or throws. That strictness is what lets `bravoh-peaks` treat a
 * peaks receipt as a stable content-addressable value instead of "probably the
 * same bytes".
 */

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

const DECODE_INDEX = /* @__PURE__ */ (() => {
  const table = new Int16Array(128).fill(-1);
  for (let index = 0; index < ALPHABET.length; index += 1) {
    table[ALPHABET.charCodeAt(index)] = index;
  }
  return table;
})();

/** Encode bytes as canonical unpadded base64url. */
export function encodeBase64Url(bytes: Uint8Array): string {
  let out = "";
  let accumulator = 0;
  let bitCount = 0;
  for (let index = 0; index < bytes.length; index += 1) {
    accumulator = (accumulator << 8) | bytes[index]!;
    bitCount += 8;
    while (bitCount >= 6) {
      bitCount -= 6;
      out += ALPHABET[(accumulator >>> bitCount) & 0x3f];
    }
    // Keep only the residual low bits so the accumulator never overflows int32.
    accumulator &= (1 << bitCount) - 1;
  }
  if (bitCount > 0) {
    out += ALPHABET[(accumulator << (6 - bitCount)) & 0x3f];
  }
  return out;
}

/**
 * Decode canonical unpadded base64url to bytes.
 *
 * Throws `TypeError` on padding, any non-alphabet character, an impossible
 * length (`% 4 === 1`), or non-zero trailing bits (a non-canonical encoding).
 */
export function decodeBase64Url(value: string): Uint8Array {
  if (value.includes("=") || value.length % 4 === 1) {
    throw new TypeError("invalid unpadded base64url");
  }
  const outputLength = Math.floor((value.length * 6) / 8);
  const output = new Uint8Array(outputLength);
  let accumulator = 0;
  let bitCount = 0;
  let outputIndex = 0;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    const digit = code < DECODE_INDEX.length ? (DECODE_INDEX[code] ?? -1) : -1;
    if (digit < 0) throw new TypeError("invalid unpadded base64url");
    accumulator = accumulator * 64 + digit;
    bitCount += 6;
    if (bitCount >= 8) {
      bitCount -= 8;
      output[outputIndex] = (accumulator >>> bitCount) & 0xff;
      outputIndex += 1;
      accumulator &= (1 << bitCount) - 1;
    }
  }
  if (accumulator !== 0 || outputIndex !== outputLength) {
    throw new TypeError("non-canonical unpadded base64url");
  }
  return output;
}

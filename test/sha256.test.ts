import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { sha256Hex } from "../src/sha256.js";

const here = dirname(fileURLToPath(import.meta.url));
const enc = new TextEncoder();

describe("sha256Hex", () => {
  it("matches published FIPS 180-4 test vectors", () => {
    expect(sha256Hex(enc.encode(""))).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
    expect(sha256Hex(enc.encode("abc"))).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
    expect(
      sha256Hex(enc.encode("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq")),
    ).toBe("248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1");
  });

  it("handles inputs across every block-boundary padding case", () => {
    // 55 and 56 bytes straddle the one-block / two-block padding split.
    expect(sha256Hex(enc.encode("a".repeat(55)))).toHaveLength(64);
    expect(sha256Hex(enc.encode("a".repeat(56)))).toHaveLength(64);
    expect(sha256Hex(enc.encode("a".repeat(64)))).toBe(
      "ffe054fe7ae0cb6dc65c3af9b61d5209f439851db43d0ba5997337df154668eb",
    );
    expect(sha256Hex(enc.encode("a".repeat(1000)))).toBe(
      "41edece42d63e8d9bf515a9ba6932e1c20cbc9f5a5d134645adb5db1b9737ea3",
    );
  });

  it("binds the exact bytes of the WAV fixtures (cross-checks the goldens)", () => {
    for (const name of ["mono-sine", "quiet-pulses", "stereo-transients"]) {
      const wav = readFileSync(join(here, "fixtures", `${name}.wav`));
      const golden = JSON.parse(readFileSync(join(here, "golden", `${name}.json`), "utf8"));
      expect(sha256Hex(wav)).toBe(golden.assetSha256);
    }
  });
});

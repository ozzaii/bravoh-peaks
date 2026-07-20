import { describe, expect, it } from "vitest";
import { decodeBase64Url, encodeBase64Url } from "../src/base64url.js";

describe("base64url codec", () => {
  it("round-trips arbitrary bytes", () => {
    for (let length = 0; length < 260; length += 1) {
      const bytes = new Uint8Array(length);
      for (let index = 0; index < length; index += 1) bytes[index] = (index * 37 + 11) & 0xff;
      const encoded = encodeBase64Url(bytes);
      expect(encoded).toMatch(/^[A-Za-z0-9_-]*$/);
      expect(Array.from(decodeBase64Url(encoded))).toEqual(Array.from(bytes));
    }
  });

  it("emits canonical unpadded output", () => {
    expect(encodeBase64Url(new Uint8Array([0]))).toBe("AA");
    expect(encodeBase64Url(new Uint8Array([255, 255]))).toBe("__8");
    expect(encodeBase64Url(new Uint8Array([0xfb]))).toBe("-w");
    expect(encodeBase64Url(new Uint8Array([]))).toBe("");
  });

  it("rejects padding, bad characters, and non-canonical trailing bits", () => {
    expect(() => decodeBase64Url("AA==")).toThrow(TypeError);
    expect(() => decodeBase64Url("A")).toThrow(TypeError); // length % 4 === 1
    expect(() => decodeBase64Url("**")).toThrow(TypeError);
    expect(() => decodeBase64Url("AB")).toThrow(/non-canonical/); // trailing bits set
    expect(() => decodeBase64Url("/w")).toThrow(TypeError); // standard-base64 char
  });
});

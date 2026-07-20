import { describe, expect, it } from "vitest";
import { renderPeaksSvg } from "../src/svg.js";
import { encodeAudioPeaks } from "../src/encode.js";

describe("renderPeaksSvg", () => {
  const values = [0, 0.25, 0.5, 0.75, 1];

  it("renders a valid, sized SVG document from raw values", () => {
    const svg = renderPeaksSvg(values, { width: 320, height: 64 });
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg.endsWith("</svg>")).toBe(true);
    expect(svg).toContain('viewBox="0 0 320 64"');
    expect((svg.match(/<rect/g) ?? []).length).toBe(values.length);
  });

  it("accepts a receipt directly", () => {
    const peaks = encodeAudioPeaks([new Float32Array(1000).map((_, i) => Math.sin(i / 3))], {
      sampleRateHz: 44_100,
      bucketCount: 64,
    });
    const svg = renderPeaksSvg(peaks, { style: "bars" });
    expect((svg.match(/<rect/g) ?? []).length).toBe(64);
  });

  it("supports the line style", () => {
    const svg = renderPeaksSvg(values, { style: "line" });
    expect(svg).toContain("<path");
    expect(svg).not.toContain("<rect");
  });

  it("paints a background only when asked and escapes it", () => {
    expect(renderPeaksSvg(values)).not.toContain("<rect width=");
    const svg = renderPeaksSvg(values, { background: "#0a0a0a" });
    expect(svg).toContain('<rect width="640" height="96" fill="#0a0a0a"');
  });

  it("handles an empty envelope", () => {
    const svg = renderPeaksSvg([]);
    expect(svg).toContain("<svg");
    expect(svg).not.toContain("<rect x=");
  });
});

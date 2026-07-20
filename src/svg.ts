/**
 * Render a peaks envelope to a standalone SVG string — no DOM, no canvas, no
 * dependencies. Works in the browser, in Node (server-rendered waveforms), and
 * in the CLI. Feed it either the `[0, 1]` values from {@link expandAudioPeaks}
 * or a raw receipt.
 */

import { expandAudioPeaks } from "./decode.js";
import { type AudioPeaks } from "./format.js";

export interface RenderSvgOptions {
  width?: number;
  height?: number;
  /** Bar fill (any CSS colour). Default `currentColor` so it inherits. */
  color?: string;
  /** Background fill, or `null`/omit for transparent. */
  background?: string | null;
  /** Gap between bars in px. Default 1. */
  gap?: number;
  /** Corner radius on bars in px. Default 1. */
  radius?: number;
  /** Minimum bar height in px so silence is still visible. Default 1. */
  minBarHeight?: number;
  /** `"mirror"` (centred, default), `"bars"` (bottom-up), or `"line"`. */
  style?: "mirror" | "bars" | "line";
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function toValues(input: AudioPeaks | ReadonlyArray<number>): number[] {
  return Array.isArray(input) ? (input as number[]) : expandAudioPeaks(input as AudioPeaks);
}

/** Render a waveform as an SVG document string. */
export function renderPeaksSvg(
  input: AudioPeaks | ReadonlyArray<number>,
  options: RenderSvgOptions = {},
): string {
  const values = toValues(input);
  const width = options.width ?? 640;
  const height = options.height ?? 96;
  const gap = options.gap ?? 1;
  const radius = options.radius ?? 1;
  const minBar = options.minBarHeight ?? 1;
  const color = options.color ?? "currentColor";
  const style = options.style ?? "mirror";
  const count = values.length;

  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" ` +
      `width="${width}" height="${height}" role="img" aria-label="audio waveform">`,
  ];
  if (options.background != null) {
    parts.push(`<rect width="${width}" height="${height}" fill="${escapeAttr(options.background)}"/>`);
  }

  if (count === 0) {
    parts.push("</svg>");
    return parts.join("");
  }

  if (style === "line") {
    const mid = height / 2;
    let d = "";
    for (let index = 0; index < count; index += 1) {
      const x = count === 1 ? width / 2 : (index / (count - 1)) * width;
      const y = mid - (values[index]! * height) / 2;
      d += `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    }
    parts.push(
      `<path d="${d}" fill="none" stroke="${escapeAttr(color)}" stroke-width="1.5" ` +
        `stroke-linejoin="round" stroke-linecap="round"/>`,
    );
    parts.push("</svg>");
    return parts.join("");
  }

  const barWidth = Math.max(0.1, width / count - gap);
  const rx = Math.min(radius, barWidth / 2);
  for (let index = 0; index < count; index += 1) {
    const value = values[index]!;
    const x = (index / count) * width + gap / 2;
    let barHeight: number;
    let y: number;
    if (style === "mirror") {
      barHeight = Math.max(minBar, value * height);
      y = (height - barHeight) / 2;
    } else {
      barHeight = Math.max(minBar, value * height);
      y = height - barHeight;
    }
    parts.push(
      `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${barWidth.toFixed(2)}" ` +
        `height="${barHeight.toFixed(2)}" rx="${rx.toFixed(2)}" fill="${escapeAttr(color)}"/>`,
    );
  }
  parts.push("</svg>");
  return parts.join("");
}

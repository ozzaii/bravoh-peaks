#!/usr/bin/env node
/**
 * bravoh-peaks CLI — extract waveform peaks from a WAV file.
 *
 *   npx bravoh-peaks track.wav                 # compact receipt JSON → stdout
 *   npx bravoh-peaks track.wav --buckets 500   # higher-resolution waveform
 *   npx bravoh-peaks track.wav --svg wave.svg  # also render an SVG
 */

import { readFileSync, writeFileSync } from "node:fs";
import { peaksFromWav } from "./wav.js";
import { renderPeaksSvg } from "./svg.js";

const HELP = `bravoh-peaks — waveform peaks from a WAV file

USAGE
  bravoh-peaks <file.wav> [options]

OPTIONS
  --buckets <n>    number of peaks to emit (default 192)
  --svg [file]     also write an SVG waveform (default <file>.svg; "-" = stdout)
  --width <n>      SVG width in px (default 640)
  --height <n>     SVG height in px (default 96)
  --color <css>    SVG bar colour (default #111)
  --pretty         pretty-print the JSON receipt
  --no-hash        omit the assetSha256 binding
  -h, --help       show this help
  -v, --version    print version

The JSON receipt is written to stdout; render it later with renderPeaksSvg,
or feed it to any audio-peaks.v1 consumer.`;

interface Args {
  file?: string;
  buckets?: number;
  svg?: string | true;
  width?: number;
  height?: number;
  color?: string;
  pretty: boolean;
  hash: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { pretty: false, hash: true };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]!;
    const next = (): string => {
      const value = argv[++index];
      if (value === undefined) throw new Error(`missing value for ${token}`);
      return value;
    };
    switch (token) {
      case "-h":
      case "--help":
        process.stdout.write(`${HELP}\n`);
        process.exit(0);
        break;
      case "-v":
      case "--version":
        process.stdout.write(`${VERSION}\n`);
        process.exit(0);
        break;
      case "--buckets":
        args.buckets = Number.parseInt(next(), 10);
        break;
      case "--svg":
        args.svg = argv[index + 1] && !argv[index + 1]!.startsWith("-") ? next() : true;
        break;
      case "--width":
        args.width = Number.parseInt(next(), 10);
        break;
      case "--height":
        args.height = Number.parseInt(next(), 10);
        break;
      case "--color":
        args.color = next();
        break;
      case "--pretty":
        args.pretty = true;
        break;
      case "--no-hash":
        args.hash = false;
        break;
      default:
        if (token.startsWith("-")) throw new Error(`unknown option ${token}`);
        args.file = token;
    }
  }
  return args;
}

// Replaced at build time with the package version.
declare const __VERSION__: string;
const VERSION = typeof __VERSION__ === "string" ? __VERSION__ : "0.0.0";

function main(): void {
  let args: Args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`bravoh-peaks: ${(error as Error).message}\n`);
    process.exit(2);
    return;
  }

  if (!args.file) {
    process.stderr.write(`${HELP}\n`);
    process.exit(args.file === undefined ? 1 : 0);
    return;
  }

  let receipt;
  try {
    const bytes = readFileSync(args.file);
    receipt = peaksFromWav(bytes, { bucketCount: args.buckets });
    if (!args.hash) delete (receipt as { assetSha256?: string }).assetSha256;
  } catch (error) {
    process.stderr.write(`bravoh-peaks: ${(error as Error).message}\n`);
    process.exit(1);
    return;
  }

  if (args.svg) {
    const svg = renderPeaksSvg(receipt, {
      width: args.width,
      height: args.height,
      color: args.color ?? "#111",
      background: null,
    });
    if (args.svg === "-") {
      process.stdout.write(`${svg}\n`);
    } else {
      const target = args.svg === true ? `${args.file}.svg` : args.svg;
      writeFileSync(target, svg);
      process.stderr.write(`bravoh-peaks: wrote ${target}\n`);
    }
  }

  process.stdout.write(`${JSON.stringify(receipt, null, args.pretty ? 2 : 0)}\n`);
}

main();

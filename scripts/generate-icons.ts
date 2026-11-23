import { deflateSync } from "node:zlib";

const BACKGROUND = [0x0b, 0x0e, 0x14] as const;
const FOREGROUND = [0xe6, 0xb4, 0x50] as const;

// The `>_` prompt drawn on a 16x16 pixel grid; "#" marks a lit pixel.
const GLYPH = [
  "................",
  "................",
  "................",
  "................",
  "...##...........",
  "....##..........",
  ".....##.........",
  "......##........",
  ".....##.........",
  "....##..........",
  "...##....#####..",
  ".........#####..",
  "................",
  "................",
  "................",
  "................",
];

function isLit(x: number, y: number, size: number): boolean {
  const cell = size / GLYPH.length;
  return GLYPH[Math.floor(y / cell)]?.[Math.floor(x / cell)] === "#";
}

function chunk(type: string, data: Uint8Array): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(Bun.hash.crc32(body));
  return Buffer.concat([length, body, crc]);
}

function png(size: number): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 2, 0, 0, 0], 8);

  const rows = Buffer.alloc(size * (1 + size * 3));
  for (let y = 0; y < size; y++) {
    const row = y * (1 + size * 3);
    for (let x = 0; x < size; x++) {
      rows.set(isLit(x, y, size) ? FOREGROUND : BACKGROUND, row + 1 + x * 3);
    }
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(rows)),
    chunk("IEND", new Uint8Array()),
  ]);
}

function svg(): string {
  const hex = (color: readonly number[]) =>
    `#${color.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
  const pixels = GLYPH.flatMap((line, y) =>
    [...line].flatMap((cell, x) =>
      cell === "#" ? [`<rect x="${x}" y="${y}" width="1" height="1"/>`] : [],
    ),
  );
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges"><rect width="16" height="16" fill="${hex(BACKGROUND)}"/><g fill="${hex(FOREGROUND)}">${pixels.join("")}</g></svg>\n`;
}

await Bun.write("public/icons/icon-192.png", png(192));
await Bun.write("public/icons/icon-512.png", png(512));
await Bun.write("public/icons/apple-touch-icon.png", png(180));
await Bun.write("src/icon.svg", svg());

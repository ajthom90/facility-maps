/**
 * Best-effort intrinsic pixel size of an uploaded floor plan.
 * Used so the viewer can letterbox the *plan box* (not the overlay vs the image).
 */

export type PlanDimensions = { width: number; height: number };

export function readPlanDimensions(
  buffer: Buffer,
  mimeType: string,
): PlanDimensions | null {
  if (mimeType === "image/svg+xml") return readSvgDimensions(buffer);
  if (mimeType === "image/png") return readPngDimensions(buffer);
  if (mimeType === "image/jpeg") return readJpegDimensions(buffer);
  return null;
}

function readSvgDimensions(buffer: Buffer): PlanDimensions | null {
  const text = buffer.toString("utf8").slice(0, 8192);
  const viewBox = text.match(
    /viewBox\s*=\s*["']\s*[-+0-9.eE]+\s+[-+0-9.eE]+\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)\s*["']/,
  );
  if (viewBox) {
    const width = Number(viewBox[1]);
    const height = Number(viewBox[2]);
    if (isPositive(width) && isPositive(height)) return { width, height };
  }
  const widthAttr = parseSvgLength(text.match(/\bwidth\s*=\s*["']\s*([^"']+)\s*["']/i)?.[1]);
  const heightAttr = parseSvgLength(text.match(/\bheight\s*=\s*["']\s*([^"']+)\s*["']/i)?.[1]);
  if (widthAttr != null && heightAttr != null) {
    return { width: widthAttr, height: heightAttr };
  }
  return null;
}

function parseSvgLength(raw: string | undefined): number | null {
  if (!raw) return null;
  const m = raw.trim().match(/^([-+0-9.eE]+)/);
  if (!m) return null;
  const n = Number(m[1]);
  return isPositive(n) ? n : null;
}

function readPngDimensions(buffer: Buffer): PlanDimensions | null {
  // PNG signature + IHDR: width/height at bytes 16–23
  if (buffer.length < 24) return null;
  if (buffer[0] !== 0x89 || buffer[1] !== 0x50 || buffer[2] !== 0x4e || buffer[3] !== 0x47) {
    return null;
  }
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  if (isPositive(width) && isPositive(height)) return { width, height };
  return null;
}

function readJpegDimensions(buffer: Buffer): PlanDimensions | null {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let i = 2;
  while (i + 8 < buffer.length) {
    if (buffer[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = buffer[i + 1];
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    const length = buffer.readUInt16BE(i + 2);
    if (length < 2 || i + 2 + length > buffer.length) break;
    // SOF0–SOF3, SOF5–SOF7, SOF9–SOF11, SOF13–SOF15
    const isSof =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);
    if (isSof && length >= 7) {
      const height = buffer.readUInt16BE(i + 5);
      const width = buffer.readUInt16BE(i + 7);
      if (isPositive(width) && isPositive(height)) return { width, height };
      return null;
    }
    i += 2 + length;
  }
  return null;
}

function isPositive(n: number): boolean {
  return Number.isFinite(n) && n > 0;
}

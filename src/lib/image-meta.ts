/**
 * Identifies JPEG, PNG and WebP images from their bytes (never trusting the filename or the
 * client's MIME type) and reads their pixel dimensions from the header.
 */
export type ImageFormat = "jpeg" | "png" | "webp";

export interface ImageMeta {
  format: ImageFormat;
  mimeType: string;
  extension: string;
  width: number;
  height: number;
}

export const MAX_IMAGE_DIMENSION = 10_000;

const MIME: Record<ImageFormat, { mimeType: string; extension: string }> = {
  jpeg: { mimeType: "image/jpeg", extension: "jpg" },
  png: { mimeType: "image/png", extension: "png" },
  webp: { mimeType: "image/webp", extension: "webp" },
};

function ascii(bytes: Uint8Array, start: number, length: number) {
  return String.fromCharCode(...bytes.subarray(start, start + length));
}

function pngSize(b: Uint8Array) {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (b.length < 24 || !sig.every((v, i) => b[i] === v) || ascii(b, 12, 4) !== "IHDR") return null;
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

function jpegSize(b: Uint8Array) {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8 || b[2] !== 0xff) return null;
  let offset = 2;
  while (offset + 9 < b.length) {
    if (b[offset] !== 0xff) return null;
    const marker = b[offset + 1]!;
    if (marker === 0xff) {
      offset++;
      continue;
    }
    const length = (b[offset + 2]! << 8) | b[offset + 3]!;
    // SOF0–SOF15 carry dimensions, except DHT (C4), JPG (C8) and DAC (CC).
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: (b[offset + 5]! << 8) | b[offset + 6]!, width: (b[offset + 7]! << 8) | b[offset + 8]! };
    }
    if (length < 2) return null;
    offset += 2 + length;
  }
  return null;
}

function webpSize(b: Uint8Array) {
  if (b.length < 30 || ascii(b, 0, 4) !== "RIFF" || ascii(b, 8, 4) !== "WEBP") return null;
  const chunk = ascii(b, 12, 4);
  if (chunk === "VP8 ") return { width: ((b[27]! << 8) | b[26]!) & 0x3fff, height: ((b[29]! << 8) | b[28]!) & 0x3fff };
  if (chunk === "VP8L") {
    return {
      width: 1 + (((b[22]! & 0x3f) << 8) | b[21]!),
      height: 1 + (((b[24]! & 0x0f) << 10) | (b[23]! << 2) | ((b[22]! & 0xc0) >> 6)),
    };
  }
  if (chunk === "VP8X") {
    return { width: 1 + (b[24]! | (b[25]! << 8) | (b[26]! << 16)), height: 1 + (b[27]! | (b[28]! << 8) | (b[29]! << 16)) };
  }
  return null;
}

/** Returns image metadata, or null when the bytes are not a supported, sanely sized image. */
export function readImageMeta(bytes: Uint8Array): ImageMeta | null {
  const detectors: [ImageFormat, (b: Uint8Array) => { width: number; height: number } | null][] = [
    ["jpeg", jpegSize],
    ["png", pngSize],
    ["webp", webpSize],
  ];
  for (const [format, detect] of detectors) {
    const size = detect(bytes);
    if (!size) continue;
    if (size.width < 1 || size.height < 1 || size.width > MAX_IMAGE_DIMENSION || size.height > MAX_IMAGE_DIMENSION) return null;
    return { format, ...MIME[format], ...size };
  }
  return null;
}

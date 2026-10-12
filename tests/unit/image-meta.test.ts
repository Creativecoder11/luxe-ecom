import { describe, expect, it } from "vitest";
import { readImageMeta } from "@/lib/image-meta";

function png(width: number, height: number) {
  const b = new Uint8Array(33);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  new DataView(b.buffer).setUint32(16, width);
  new DataView(b.buffer).setUint32(20, height);
  return b;
}

function jpeg(width: number, height: number) {
  // SOI, APP0 (length 16), SOF0 with dimensions.
  const app0 = [0xff, 0xe0, 0x00, 0x10, ...new Array(14).fill(0)];
  const sof = [0xff, 0xc0, 0x00, 0x11, 0x08, height >> 8, height & 255, width >> 8, width & 255, 3, ...new Array(9).fill(0)];
  return new Uint8Array([0xff, 0xd8, ...app0, ...sof]);
}

function webpVp8x(width: number, height: number) {
  const b = new Uint8Array(30);
  b.set([..."RIFF"].map((c) => c.charCodeAt(0)), 0);
  b.set([..."WEBP"].map((c) => c.charCodeAt(0)), 8);
  b.set([..."VP8X"].map((c) => c.charCodeAt(0)), 12);
  const w = width - 1;
  const h = height - 1;
  b.set([w & 255, (w >> 8) & 255, (w >> 16) & 255, h & 255, (h >> 8) & 255, (h >> 16) & 255], 24);
  return b;
}

describe("readImageMeta", () => {
  it("detects PNG, JPEG and WebP by content with dimensions", () => {
    expect(readImageMeta(png(800, 600))).toMatchObject({ format: "png", mimeType: "image/png", width: 800, height: 600 });
    expect(readImageMeta(jpeg(1200, 1500))).toMatchObject({ format: "jpeg", extension: "jpg", width: 1200, height: 1500 });
    expect(readImageMeta(webpVp8x(1000, 1000))).toMatchObject({ format: "webp", width: 1000, height: 1000 });
  });

  it("rejects non-images, disguised files and absurd dimensions", () => {
    expect(readImageMeta(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
    expect(readImageMeta(new TextEncoder().encode("GIF89a........"))).toBeNull();
    expect(readImageMeta(new Uint8Array([0xff, 0xd8, 0xff]))).toBeNull();
    expect(readImageMeta(png(50_000, 50_000))).toBeNull();
    expect(readImageMeta(png(0, 10))).toBeNull();
  });
});

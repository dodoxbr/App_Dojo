import sharp from "sharp";
import { MAX_IMAGE_SIDE, MAX_STORED_BYTES } from "@dojo/contracts/feed";

export class ImageError extends Error {
  readonly kind: "format" | "decode" | "size";
  constructor(kind: "format" | "decode" | "size") {
    super(kind);
    this.kind = kind;
  }
}

const ALLOWED = new Set(["jpeg", "png", "webp"]);

// Everything a phone camera adds to a picture (GPS position, camera, date, thumbnails, color profile) is dropped:
// the picture is decoded, rotated by its EXIF orientation, resized and written again as a plain JPEG with no metadata.
export async function prepareFeedImage(input: Buffer): Promise<{ data: Buffer; width: number; height: number }> {
  const options = { failOn: "error" as const, limitInputPixels: 80_000_000 };
  let format: string | undefined;
  try {
    format = (await sharp(input, options).metadata()).format;
  } catch {
    throw new ImageError("decode");
  }
  if (!format || !ALLOWED.has(format)) throw new ImageError("format");

  // Try a few sizes/qualities until the result fits the stored limit.
  for (const [side, quality] of [[MAX_IMAGE_SIDE, 80], [MAX_IMAGE_SIDE, 65], [1280, 60], [1024, 55]] as const) {
    try {
      const { data, info } = await sharp(input, options)
        .rotate() // applies the EXIF orientation; the tag itself is not kept
        .resize({ width: side, height: side, fit: "inside", withoutEnlargement: true })
        .flatten({ background: "#ffffff" }) // transparency (PNG/WebP) becomes white
        .jpeg({ quality, mozjpeg: true })
        .toBuffer({ resolveWithObject: true });
      if (data.length <= MAX_STORED_BYTES) return { data, width: info.width, height: info.height };
    } catch {
      throw new ImageError("decode");
    }
  }
  throw new ImageError("size");
}

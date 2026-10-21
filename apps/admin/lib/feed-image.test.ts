import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { ImageError, prepareFeedImage } from "./feed-image.ts";

// A big photo with a GPS position, camera data and a sideways orientation, like a phone would produce.
async function phonePhoto(): Promise<Buffer> {
  return sharp({ create: { width: 3000, height: 2000, channels: 3, background: { r: 200, g: 120, b: 40 } } })
    .withExif({
      IFD0: { Make: "CameraSecreta", Model: "ModeloSecreto", ImageDescription: "endereco-secreto-da-casa" },
      IFD3: { GPSLatitudeRef: "S", GPSLatitude: "23/1 32/1 0/1", GPSLongitudeRef: "W", GPSLongitude: "46/1 38/1 0/1" },
    })
    .withMetadata({ orientation: 6 }) // sideways, as phones store portrait shots
    .jpeg()
    .toBuffer();
}

test("the source photo really carries metadata (so the test below means something)", async () => {
  const input = await phonePhoto();
  const meta = await sharp(input).metadata();
  assert.ok(meta.exif, "a foto de entrada tem EXIF");
  assert.equal(meta.orientation, 6, "e esta de lado (orientacao 6)");
  assert.ok(input.includes(Buffer.from("endereco-secreto-da-casa")));
});

test("metadata, GPS and camera data are removed; the picture is a plain JPEG", async () => {
  const out = await prepareFeedImage(await phonePhoto());
  const meta = await sharp(out.data).metadata();
  assert.equal(meta.format, "jpeg");
  assert.equal(meta.exif, undefined, "sem EXIF");
  assert.equal(meta.icc, undefined, "sem perfil de cor embutido");
  assert.equal(meta.xmp, undefined);
  assert.equal(meta.iptc, undefined);
  for (const secret of ["endereco-secreto-da-casa", "CameraSecreta", "ModeloSecreto", "GPSLatitude", "Exif"]) {
    assert.equal(out.data.includes(Buffer.from(secret)), false, `nao contem ${secret}`);
  }
  assert.deepEqual([...out.data.subarray(0, 3)], [0xff, 0xd8, 0xff], "assinatura JPEG");
});

test("the orientation is applied and the picture is reduced to 1600 px", async () => {
  const out = await prepareFeedImage(await phonePhoto());
  // 3000x2000 with orientation 6 is portrait: 2000x3000 -> fits 1600 on the long side
  assert.equal(out.height, 1600);
  assert.ok(out.width < out.height, "ficou em pe");
  assert.ok(out.data.length <= 800_000);
});

test("small pictures are not enlarged and transparency becomes white", async () => {
  const png = await sharp({ create: { width: 100, height: 80, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
  const out = await prepareFeedImage(png);
  assert.equal(out.width, 100);
  assert.equal(out.height, 80);
  const { data } = await sharp(out.data).raw().toBuffer({ resolveWithObject: true });
  assert.ok(data[0] > 240 && data[1] > 240 && data[2] > 240, "fundo transparente virou branco");
});

test("only JPEG, PNG and WebP are accepted; anything else is refused", async () => {
  const tiff = await sharp({ create: { width: 10, height: 10, channels: 3, background: "#fff" } }).tiff().toBuffer();
  await assert.rejects(prepareFeedImage(tiff), (e: unknown) => e instanceof ImageError && e.kind === "format");
  await assert.rejects(prepareFeedImage(Buffer.from("isto nao e uma imagem")), (e: unknown) => e instanceof ImageError && e.kind === "decode");
  await assert.rejects(prepareFeedImage(Buffer.alloc(0)), (e: unknown) => e instanceof ImageError);
  const webp = await sharp({ create: { width: 50, height: 50, channels: 3, background: "#123456" } }).webp().toBuffer();
  assert.equal((await prepareFeedImage(webp)).width, 50);
});

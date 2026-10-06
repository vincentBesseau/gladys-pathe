import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { fitImageForWidget, MAX_BYTES } from '../src/image.js';

async function noisyJpeg(width, height) {
  return sharp({
    create: { width, height, channels: 3, noise: { type: 'gaussian', mean: 128, sigma: 60 } },
  })
    .jpeg({ quality: 95 })
    .toBuffer();
}

test('fitImageForWidget returns a small accepted image untouched', async () => {
  const small = await noisyJpeg(100, 150);

  assert.ok(small.length <= MAX_BYTES);
  assert.equal(await fitImageForWidget(small), small);
});

test('fitImageForWidget downscales an image above the 300 KB cap into a JPEG under it', async () => {
  const big = await noisyJpeg(1200, 1800);

  assert.ok(big.length > MAX_BYTES, 'the fixture must exceed the cap');

  const fitted = await fitImageForWidget(big);
  const { format, width } = await sharp(fitted).metadata();

  assert.ok(fitted.length <= MAX_BYTES);
  assert.equal(format, 'jpeg');
  assert.ok(width <= 600);
});

test('fitImageForWidget converts a small image in a format Gladys rejects into a JPEG', async () => {
  const gif = await sharp({
    create: { width: 50, height: 50, channels: 3, background: '#336699' },
  })
    .gif()
    .toBuffer();

  const fitted = await fitImageForWidget(gif);

  assert.equal((await sharp(fitted).metadata()).format, 'jpeg');
});

test('fitImageForWidget flattens transparency onto white when re-encoding to JPEG', async () => {
  const transparent = await sharp({
    create: { width: 40, height: 40, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .gif()
    .toBuffer();

  const fitted = await fitImageForWidget(transparent);
  const { data } = await sharp(fitted).raw().toBuffer({ resolveWithObject: true });

  assert.ok(data[0] > 240 && data[1] > 240 && data[2] > 240);
});

test('fitImageForWidget rejects bytes that are not an image', async () => {
  await assert.rejects(fitImageForWidget(Buffer.from('not an image')));
});

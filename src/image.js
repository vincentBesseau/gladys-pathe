// -----------------------------------------------------------------------------
// Fit a poster to what Gladys accepts for a dashboard widget image
// (capabilities/dashboard-widgets.md, section 6): PNG, JPEG or WebP, at most
// 300 KB once decoded and at most 4096 px per side. Cinema CDNs sometimes serve
// posters well above that, and Gladys rejects them (broken image in the
// widget), so anything outside the limits is downscaled and re-encoded here.
// -----------------------------------------------------------------------------

import sharp from 'sharp';

const MAX_BYTES = 300 * 1024;
const MAX_DIMENSION = 4096;
const ACCEPTED_FORMATS = new Set(['jpeg', 'png', 'webp']);

// Widest first: a poster card is small, so 600 px is already generous.
const WIDTHS = [600, 480, 400, 320];
const QUALITIES = [85, 75, 65, 50];

/**
 * @param {Buffer} bytes - The image as served by the cinema site.
 * @returns {Promise<Buffer>} The same bytes when Gladys already accepts them,
 * otherwise a downscaled JPEG under the size cap.
 */
async function fitImageForWidget(bytes) {
  const image = sharp(bytes);
  const { format, width, height } = await image.metadata();

  if (
    bytes.length <= MAX_BYTES &&
    ACCEPTED_FORMATS.has(format) &&
    width <= MAX_DIMENSION &&
    height <= MAX_DIMENSION
  ) {
    return bytes;
  }

  for (const targetWidth of WIDTHS) {
    for (const quality of QUALITIES) {
      const resized = await sharp(bytes)
        .flatten({ background: '#ffffff' })
        .resize({ width: targetWidth, withoutEnlargement: true })
        .jpeg({ quality, mozjpeg: true })
        .toBuffer();

      if (resized.length <= MAX_BYTES) {
        return resized;
      }
    }
  }

  throw new Error(`Image still above ${MAX_BYTES} bytes after downscaling`);
}

export { fitImageForWidget, MAX_BYTES };

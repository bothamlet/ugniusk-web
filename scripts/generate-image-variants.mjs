// Regenerates the responsive WebP files declared in src/data/responsiveImages.json.
//
//   node scripts/generate-image-variants.mjs           create every missing variant
//   node scripts/generate-image-variants.mjs --force   rewrite all of them
//
// Each `-<width>.webp` sits beside its source and is a plain resize at quality
// 85, never wider than the source itself. The originals are only read: they
// stay byte-identical and remain the `src`/open-original target. Sharp is a
// devDependency because this script imports it directly; Astro lists it only
// as an optional dependency, so it is not reliably installed alongside Astro.

import { readFileSync, statSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = new URL('../', import.meta.url);
const force = process.argv.includes('--force');

/** Every shipped source and the variant widths generated beside it. */
const images = JSON.parse(readFileSync(new URL('src/data/responsiveImages.json', root), 'utf8'));

const variantPath = (src, width) => src.replace(/\.webp$/, `-${width}.webp`);
const here = (path) => fileURLToPath(new URL(`public${path}`, root));

let created = 0;
let skipped = 0;

for (const [src, image] of Object.entries(images)) {
	const source = here(src);
	const actual = await sharp(source).metadata();

	// The table describes the shipped file, so a replaced image whose new
	// resolution was not recorded here fails instead of generating stale copies.
	if (actual.width !== image.width || actual.height !== image.height) {
		throw new Error(
			`${src} is ${actual.width}x${actual.height}, table says ${image.width}x${image.height}`,
		);
	}

	// A plain resize keeps only the first frame of an animated WebP. The three
	// Surface Runoff figures are 160-frame plots, and a same-quality animated
	// re-encode is larger than the original, so they ship no variants at all.
	if ((actual.pages ?? 1) > 1 && image.variants.length > 0) {
		throw new Error(
			`${src} is animated (${actual.pages} frames): a resized copy would drop every frame but the first`,
		);
	}

	for (const width of image.variants) {
		if (width >= image.width) {
			throw new Error(`${src} is ${image.width}px wide: a ${width}px variant would enlarge it`);
		}

		const target = here(variantPath(src, width));
		if (!force) {
			try {
				const existing = await sharp(target).metadata();
				if (existing.width === width) {
					skipped += 1;
					continue;
				}
			} catch {
				// Missing or unreadable: fall through and write it.
			}
		}

		const bytes = await sharp(source).resize({ width }).webp({ quality: 85 }).toBuffer();
		const written = await sharp(bytes).metadata();
		await writeFile(target, bytes);
		created += 1;
		console.log(
			`${variantPath(src, width)} — ${written.width}x${written.height}, ${(statSync(target).size / 1024).toFixed(0)} KB`,
		);
	}
}

console.log(`${created} written, ${skipped} already at their declared width`);

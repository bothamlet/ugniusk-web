import responsiveImagesJson from './responsiveImages.json' with { type: 'json' };

/**
 * One shipped WebP asset that has generated responsive variants beside it.
 * `width`/`height` are the source file's own pixels, read from the file, and
 * `variants` are the `-<width>.webp` siblings that exist on disk.
 */
interface ResponsiveImage {
	readonly width: number;
	readonly height: number;
	readonly variants: readonly number[];
}

export const responsiveImages: Record<string, ResponsiveImage> = responsiveImagesJson;

/** Intrinsic size and variants of a shipped asset, or `undefined` if it has none. */
export const imageFor = (src: string) => responsiveImages[src];

/**
 * The `srcset` for one source: every generated variant at its real pixel width,
 * then the untouched original at its native width as the largest candidate. A
 * source narrower than a variant width has no such variant, so the original is
 * never offered under a descriptor it cannot fill.
 *
 * An entry with no variants has no `srcset` at all: the three Surface Runoff
 * figures are 160-frame animated WebPs, and a resized copy would drop every
 * frame but the first, so they keep the original file at every viewport.
 */
export const imageSrcSet = (src: string) => {
	const image = imageFor(src);
	if (!image || image.variants.length === 0) return undefined;
	return [
		...image.variants.map((width) => `${src.replace(/\.webp$/, `-${width}.webp`)} ${width}w`),
		`${src} ${image.width}w`,
	].join(', ');
};

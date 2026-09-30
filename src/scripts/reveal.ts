/**
 * reveal.ts - the reveal and card animations. Kept in its own module on purpose.
 *
 * site-motion.ts imports this file only when a page actually has reveal targets.
 * The static `import { animate }` below is what lets Rollup tree-shake anime.js
 * down to the one export we use; importing `animejs` directly from a dynamic
 * import would ship the whole 120KB library instead.
 */
import { animate } from "animejs";

interface RevealConfig {
	direction: string;
	delay: number;
	viewport: number;
}

const isScaleReveal = (direction: string) => direction === "scale";
const isSlideFromLeft = (direction: string) => direction === "left";

const applyInitialState = (element: HTMLElement, direction: string) => {
	element.style.opacity = "0";
	if (isScaleReveal(direction)) {
		element.style.transform = "scale(0.95)";
	} else if (isSlideFromLeft(direction)) {
		element.style.transform = "translateX(-24px)";
	} else {
		element.style.transform = "translateY(24px)";
	}
};

const playReveal = (
	targets: HTMLElement[],
	config: RevealConfig,
	duration: number,
) => {
	animate(targets, {
		opacity: [0, 1],
		translateX: [isSlideFromLeft(config.direction) ? -24 : 0, 0],
		translateY: [
			isScaleReveal(config.direction) || isSlideFromLeft(config.direction)
				? 0
				: 24,
			0,
		],
		scale: [isScaleReveal(config.direction) ? 0.95 : 1, 1],
		duration,
		delay: config.delay,
		ease: "outQuad",
	});
};

const watchReveal = (element: HTMLElement, config: RevealConfig) => {
	const targets = [element];
	const duration = isScaleReveal(config.direction) ? 700 : 600;

	targets.forEach((target) => applyInitialState(target, config.direction));

	const observer = new IntersectionObserver(
		(entries) => {
			entries.forEach((entry) => {
				if (entry.isIntersecting && !element.dataset.revealAnimated) {
					element.dataset.revealAnimated = "true";
					observer.disconnect();
					playReveal(targets, config, duration);
				}
			});
		},
		{ threshold: (100 - config.viewport) / 100 },
	);

	observer.observe(element);
};

/** Reveal every [data-reveal] element as it scrolls into view. */
export const initReveals = () => {
	const elements = document.querySelectorAll<HTMLElement>("[data-reveal]");

	elements.forEach((element) => {
		if (element.dataset.revealReady === "true") return;
		element.dataset.revealReady = "true";

		watchReveal(element, {
			direction: element.dataset.revealDirection ?? "up",
			delay: Number(element.dataset.revealDelay ?? 0),
			viewport: Number(element.dataset.revealViewport ?? 85),
		});
	});
};

/** Staggered reveal for the selected-work cards. */
export const initProjectCards = () => {
	const cards = document.querySelectorAll<HTMLElement>(".selected-work__item");
	if (cards.length === 0) return;

	const observer = new IntersectionObserver(
		(entries) => {
			if (entries[0]?.isIntersecting && !cards[0]?.dataset.juiced) {
				cards.forEach((card, i) => {
					card.dataset.juiced = "true";
					card.style.opacity = "0";
					card.style.transform = "translateY(30px)";
					animate(card, {
						opacity: [0, 1],
						translateY: [30, 0],
						duration: 600,
						delay: i * 80,
						ease: "outQuad",
					});
				});
			}
		},
		{ threshold: 0.1 },
	);

	if (cards[0]) observer.observe(cards[0]);
};

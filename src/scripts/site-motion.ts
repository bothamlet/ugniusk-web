import Lenis from "lenis";
import "lenis/dist/lenis.css";
import { animate } from "animejs";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

declare global {
	interface Window {
		siteMotion?: {
			lenis: Lenis;
			refresh: () => void;
		};
	}
}

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
	const stagger = Number(element.dataset.revealStagger ?? 0);
	const targets = stagger > 0
		? Array.from(element.children) as HTMLElement[]
		: [element];
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

const revealElements = () => {
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

// Staggered reveal for project cards
const animateProjectCards = () => {
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

// Hero parallax - name shifts up + fades on scroll
const setupHeroParallax = () => {
	const heroName = document.querySelector<HTMLElement>(".hero-name");
	if (!heroName) return;

	const onScroll = () => {
		const scrollY = window.scrollY || 0;
		const heroHeight = window.innerHeight;
		const progress = Math.min(scrollY / (heroHeight * 0.8), 1);

		heroName.style.transform = `translateY(${-progress * 60}px)`;
		heroName.style.opacity = `${1 - progress * 0.6}`;
	};

	window.addEventListener("scroll", onScroll, { passive: true });
};

// Behind-work parallax depth
const setupBehindParallax = () => {
	const section = document.querySelector<HTMLElement>(".behind-work");
	if (!section) return;

	const observer = new IntersectionObserver(
		(entries) => {
			if (entries[0]?.isIntersecting && !section.dataset.parallaxReady) {
				section.dataset.parallaxReady = "true";

				const onScroll = () => {
					const rect = section.getBoundingClientRect();
					const progress = 1 - rect.top / window.innerHeight;
					const clamped = Math.max(0, Math.min(1, progress));

					const inner = section.querySelector<HTMLElement>(
						".behind-work__inner",
					);
					if (inner) {
						inner.style.transform = `translateY(${clamped * 20}px)`;
					}
				};

				window.addEventListener("scroll", onScroll, { passive: true });
			}
		},
		{ threshold: 0 },
	);

	observer.observe(section);
};

// Footer marquee speed boost when in view
const setupFooterJuice = () => {
	const track = document.querySelector<HTMLElement>(
		".site-footer__brand-track",
	);
	if (!track) return;

	const observer = new IntersectionObserver(
		(entries) => {
			if (entries[0]?.isIntersecting) {
				track.style.animationDuration = "6s";
			} else {
				track.style.animationDuration = "12s";
			}
		},
		{ threshold: 0.3 },
	);

	const footer = document.querySelector<HTMLElement>(".site-footer");
	if (footer) observer.observe(footer);
};

const fadeHero = () => {
	const hero = document.querySelector<HTMLElement>("[data-hero-fade]");
	if (!hero) return;

	animate(hero, {
		opacity: [0, 1],
		duration: 400,
		ease: "outQuad",
	});
};

const initializeMotion = () => {
	const prefersReducedMotion = window.matchMedia(REDUCED_MOTION_QUERY);

	if (prefersReducedMotion.matches) {
		document.documentElement.dataset.motion = "reduced";
		return;
	}

	document.documentElement.dataset.motion = "enabled";

	const lenis = new Lenis({
		duration: 0.85,
		easing: (time) => Math.min(1, 1.001 - 2 ** (-10 * time)),
		smoothWheel: true,
	});

	let rafId = 0;
	const updateLenis = (time: number) => {
		lenis.raf(time);
		rafId = requestAnimationFrame(updateLenis);
	};
	rafId = requestAnimationFrame(updateLenis);

	fadeHero();
	revealElements();
	animateProjectCards();
	setupHeroParallax();
	setupBehindParallax();
	setupFooterJuice();

	window.siteMotion = { lenis, refresh: () => {} };

	window.addEventListener(
		"pagehide",
		() => {
			cancelAnimationFrame(rafId);
			lenis.destroy();
			window.siteMotion = undefined;
		},
		{ once: true },
	);
};

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", initializeMotion);
} else {
	initializeMotion();
}

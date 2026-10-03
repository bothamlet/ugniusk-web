import Lenis from "lenis";
import "lenis/dist/lenis.css";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

declare global {
	interface Window {
		siteMotion?: {
			lenis: Lenis;
		};
	}
}

// Hero parallax - name shifts up + fades on scroll
//
// Viewport height is cached rather than read from the DOM on every scroll event:
// reads mixed into the scroll path force style and layout work between frames.
const setupHeroParallax = () => {
	const heroName = document.querySelector<HTMLElement>(".hero-name");
	if (!heroName) return;

	let viewportHeight = window.innerHeight;

	const update = () => {
		const progress = Math.min((window.scrollY || 0) / (viewportHeight * 0.8), 1);
		heroName.style.transform = `translateY(${-progress * 60}px)`;
		heroName.style.opacity = `${1 - progress * 0.6}`;
	};

	window.addEventListener("scroll", update, { passive: true });
	window.addEventListener(
		"resize",
		() => {
			viewportHeight = window.innerHeight;
			update();
		},
		{ passive: true },
	);
};

// Behind-work parallax depth
//
// The element and its document offset are resolved once (and again on resize),
// instead of a getBoundingClientRect plus a querySelector per scroll event.
const setupBehindParallax = () => {
	const section = document.querySelector<HTMLElement>(".behind-work");
	const inner = section?.querySelector<HTMLElement>(".behind-work__inner");
	if (!section || !inner) return;

	let viewportHeight = window.innerHeight;
	let sectionTop = 0;

	const measure = () => {
		viewportHeight = window.innerHeight;
		sectionTop = section.getBoundingClientRect().top + window.scrollY;
	};

	const update = () => {
		const progress = 1 - (sectionTop - (window.scrollY || 0)) / viewportHeight;
		const clamped = Math.max(0, Math.min(1, progress));
		inner.style.transform = `translateY(${clamped * 20}px)`;
	};

	measure();
	update();
	window.addEventListener("scroll", update, { passive: true });
	window.addEventListener(
		"resize",
		() => {
			measure();
			update();
		},
		{ passive: true },
	);
};

// Reveal and card animations live in their own chunk (scripts/reveal.ts). Project
// pages have no targets, so anime.js is never fetched there.
const loadReveals = () => {
	if (!document.querySelector("[data-reveal], .selected-work__item")) return;

	void import("./reveal").then(({ initReveals, initProjectCards }) => {
		initReveals();
		initProjectCards();
	});
};

const initializeMotion = () => {
	const prefersReducedMotion = window.matchMedia(REDUCED_MOTION_QUERY);

	if (prefersReducedMotion.matches) return;

	const lenis = new Lenis({
		// The glide knob. Higher means more inertia, which reads as lag between the
		// wheel and the page; 0.4 keeps a slight ease without the delay.
		duration: 0.4,
		easing: (time) => Math.min(1, 1.001 - 2 ** (-10 * time)),
		smoothWheel: true,
	});

	let rafId = 0;
	const updateLenis = (time: number) => {
		lenis.raf(time);
		rafId = requestAnimationFrame(updateLenis);
	};
	rafId = requestAnimationFrame(updateLenis);

	loadReveals();
	setupHeroParallax();
	setupBehindParallax();

	window.siteMotion = { lenis };

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

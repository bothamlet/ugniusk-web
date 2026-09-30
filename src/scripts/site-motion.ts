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
		// Shorter than the original 0.85s: long smoothing is most of what makes
		// the page feel like it lags behind the wheel.
		duration: 0.6,
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
	setupFooterJuice();

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

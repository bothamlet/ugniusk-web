/**
 * Text scramble effect - only the last N letters scramble.
 * Right-most letter settles first, then the one before it, etc.
 * data-scramble="scroll" -> triggers on scroll into view, re-scrambles on hover
 * data-scramble="load"   -> triggers on page load with optional delay
 * data-scramble-len="5"  -> how many trailing letters to scramble (default 5)
 */

import {
	buildScrambleQueue,
	SCRAMBLE_CHARS,
	type QueueItem,
} from "./scramble-queue.ts";

/**
 * Renders one animation frame into the element.
 * Returns true when the whole queue has settled.
 */
const renderFrame = (
	el: HTMLElement,
	queue: QueueItem[],
	frame: number,
): boolean => {
	const fragment = document.createDocumentFragment();
	let complete = 0;

	for (let i = 0, n = queue.length; i < n; i++) {
		const item = queue[i];

		if (frame >= item.end) {
			complete++;
			fragment.append(item.to);
		} else if (frame >= item.start && item.to !== " ") {
			// Keep the real character in the flow, invisible, and overlay the symbol
			// on top of it. The symbol is absolutely positioned, so it can never
			// change the line's width or wrapping while the scramble runs.
			const span = document.createElement("span");
			span.className = "scramble-char";
			span.textContent = item.to;
			const glyph = document.createElement("span");
			glyph.className = "scramble-char__glyph";
			glyph.setAttribute("aria-hidden", "true");
			glyph.textContent =
				SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
			span.append(glyph);
			fragment.append(span);
		} else {
			fragment.append(item.from);
		}
	}

	el.replaceChildren(fragment);
	return complete === queue.length;
};

class TextScramble {
	el: HTMLElement;
	originalText: string;
	scrambleLen: number;
	frame = 0;
	queue: QueueItem[] = [];
	frameRequest = 0;
	playing = false;

	constructor(el: HTMLElement) {
		this.el = el;
		this.originalText = el.textContent ?? "";
		this.scrambleLen = parseInt(el.dataset.scrambleLen || "5", 10);
	}

	scramble() {
		if (this.playing) return;

		this.queue = buildScrambleQueue(this.originalText, this.scrambleLen);

		this.cancel();
		this.playing = true;
		this.frame = 0;
		this.update();
	}

	update = () => {
		if (renderFrame(this.el, this.queue, this.frame)) {
			this.playing = false;
			this.el.textContent = this.originalText;
		} else {
			this.frameRequest = requestAnimationFrame(this.update);
			this.frame++;
		}
	};

	cancel() {
		this.playing = false;
		cancelAnimationFrame(this.frameRequest);
	}
}

function initScramble() {
	// Scrambling text is motion, so honour the preference before touching the DOM.
	// (The CSS classes this used to inject now live in global.css.)
	if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

	const elements = document.querySelectorAll<HTMLElement>("[data-scramble]");

	elements.forEach((el) => {
		const trigger = el.dataset.scramble || "scroll";
		const scrambler = new TextScramble(el);

		if (trigger === "load") {
			const delay = parseInt(el.dataset.scrambleDelay || "0", 10);
			setTimeout(() => scrambler.scramble(), delay);
		} else if (trigger === "scroll") {
			const observer = new IntersectionObserver(
				(entries) => {
					entries.forEach((entry) => {
						if (entry.isIntersecting && !el.dataset.scrambled) {
							el.dataset.scrambled = "true";
							const delay = parseInt(el.dataset.scrambleDelay || "0", 10);
							setTimeout(() => scrambler.scramble(), delay);
						}
					});
				},
				{ threshold: 0.3 },
			);
			observer.observe(el);

			// Re-scramble on hover
			el.addEventListener("mouseenter", () => {
				scrambler.scramble();
			});
		}
	});
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", initScramble);
} else {
	initScramble();
}

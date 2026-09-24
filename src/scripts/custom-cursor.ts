const finePointer = window.matchMedia("(pointer: fine)");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

if (finePointer.matches && !reducedMotion.matches) {
	const cursor = document.createElement("div");
	cursor.className = "site-cursor";
	cursor.setAttribute("aria-hidden", "true");
	const dot = document.createElement("span");
	dot.className = "site-cursor__dot";
	const ring = document.createElement("span");
	ring.className = "site-cursor__ring";
	cursor.append(dot, ring);

	document.body.append(cursor);
	document.documentElement.classList.add("custom-cursor-active");

	let targetX = 0;
	let targetY = 0;
	let currentX = 0;
	let currentY = 0;
	const ease = 0.15;

	const interactiveSelector =
		'a, button, [role="button"], input, select, textarea, .cursor-hover';

	const setHovering = (hovering: boolean) => {
		cursor.classList.toggle("site-cursor--hovering", hovering);
	};

	const handlePointerMove = (event: PointerEvent) => {
		targetX = event.clientX;
		targetY = event.clientY;

		if (!cursor.classList.contains("site-cursor--visible")) {
			cursor.classList.add("site-cursor--visible");
		}
	};

	const animate = () => {
		currentX += (targetX - currentX) * ease;
		currentY += (targetY - currentY) * ease;
		cursor.style.transform = `translate(${currentX}px, ${currentY}px)`;
		requestAnimationFrame(animate);
	};
	requestAnimationFrame(animate);

	const isHoverBoundaryExit = (event: PointerEvent) => {
		const target = event.target;
		if (!(target instanceof Element)) return true;

		const interactive = target.closest(interactiveSelector);
		if (!interactive) return true;

		const related = event.relatedTarget;
		return related instanceof Node && interactive.contains(related);
	};

	const handlePointerOver = (event: PointerEvent) => {
		if (!isHoverBoundaryExit(event)) setHovering(true);
	};

	const handlePointerOut = (event: PointerEvent) => {
		if (isHoverBoundaryExit(event)) return;
		setHovering(false);
	};

	const hideCursor = () => {
		cursor.classList.remove("site-cursor--visible");
		setHovering(false);
	};

	window.addEventListener("pointermove", handlePointerMove, { passive: true });
	document.addEventListener("pointerover", handlePointerOver);
	document.addEventListener("pointerout", handlePointerOut);
	document.documentElement.addEventListener("mouseleave", hideCursor);

	window.addEventListener(
		"pagehide",
		() => {
			window.removeEventListener("pointermove", handlePointerMove);
			document.removeEventListener("pointerover", handlePointerOver);
			document.removeEventListener("pointerout", handlePointerOut);
			document.documentElement.removeEventListener("mouseleave", hideCursor);
			document.documentElement.classList.remove("custom-cursor-active");
			cursor.remove();
		},
		{ once: true },
	);
}

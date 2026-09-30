// Deep-link handling: when landing with a #hash, keep the page hidden until
// the target exists and can be scrolled to (covers view-transition timing).

if (location.hash) {
	const hash = location.hash;

	const reveal = () => {
		document.documentElement.style.visibility = "";
	};

	const position = () => {
		// getElementById, never querySelector: a fragment like "#2026" is not a
		// valid CSS selector, and a throw here used to leave the page hidden for
		// good (the visibility is cleared below, after this returns).
		let id = hash.slice(1);
		try {
			id = decodeURIComponent(id);
		} catch {
			/* malformed percent-encoding - match the raw fragment instead */
		}
		const el = document.getElementById(id);
		if (el) {
			el.scrollIntoView();
			reveal();
			return true;
		}
		return false;
	};

	document.documentElement.style.visibility = "hidden";

	if (!position()) {
		let attempts = 0;
		const interval = setInterval(() => {
			attempts++;
			if (position() || attempts >= 50) {
				clearInterval(interval);
				reveal();
			}
		}, 10);
	}
}

// Deep-link handling: when landing with a #hash, keep the page hidden until
// the target exists and can be scrolled to (covers view-transition timing).

if (location.hash) {
	const hash = location.hash;

	const reveal = () => {
		document.documentElement.style.visibility = "";
	};

	const position = () => {
		const el = document.querySelector(hash);
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

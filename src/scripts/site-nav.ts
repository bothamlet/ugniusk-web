// Navbar visibility + anchor smooth-scroll (uses Lenis when present).

const nav = document.querySelector<HTMLElement>(".site-nav");

if (nav) {
	const isHome = () =>
		location.pathname === "/" || location.pathname === "/index.html";

	const getScrollY = () => window.siteMotion?.lenis?.scroll ?? window.scrollY;

	const updateVisibility = () => {
		// On non-home pages the nav is always visible.
		if (!isHome()) {
			nav.classList.add("site-nav--visible");
			return;
		}
		const scrollY = getScrollY();
		const heroHeight = window.innerHeight;
		if (scrollY > heroHeight * 0.6) {
			nav.classList.add("site-nav--visible");
		} else {
			nav.classList.remove("site-nav--visible");
		}
	};

	window.addEventListener("scroll", updateVisibility, { passive: true });
	setTimeout(updateVisibility, 200);
	updateVisibility();

	const allLinks = nav.querySelectorAll(".site-nav__link, .site-nav__brand");
	allLinks.forEach((link) => {
		link.addEventListener("click", (event) => {
			const href = link.getAttribute("href");
			if (!href) return;

			const hashIndex = href.indexOf("#");
			if (hashIndex === -1) return;
			const hash = href.substring(hashIndex);

			// Only intercept on the home page for smooth scroll.
			if (!isHome()) return; // let native navigation handle it

			event.preventDefault();
			const target = document.querySelector<HTMLElement>(hash);
			if (!target) return;
			const lenis = window.siteMotion?.lenis;
			if (lenis) {
				lenis.scrollTo(target, { offset: 0, duration: 1.2 });
			} else {
				target.scrollIntoView({ behavior: "smooth" });
			}
			if (hash === "#top") {
				setTimeout(() => nav.classList.remove("site-nav--visible"), 1300);
			}
		});
	});
}

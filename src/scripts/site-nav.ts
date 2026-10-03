// Navbar visibility + anchor smooth-scroll (uses Lenis when present).

const nav = document.querySelector<HTMLElement>(".site-nav");

if (nav) {
  const measureNav = () => {
    document.documentElement.style.setProperty(
      "--site-nav-height", `${nav.getBoundingClientRect().height}px`,
    );
  };
  new ResizeObserver(measureNav).observe(nav);
  measureNav();
	const isHome = () =>
		location.pathname === "/" || location.pathname === "/index.html";

	const getScrollY = () => window.scrollY;

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
			if (event instanceof MouseEvent && (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)) return;
			const href = link.getAttribute("href");
			if (!href) return;

			const hashIndex = href.indexOf("#");
			if (hashIndex === -1) return;
			const hash = href.substring(hashIndex);

			// Only intercept on the home page for smooth scroll.
			if (!isHome()) return; // let native navigation handle it

			const target = document.querySelector<HTMLElement>(hash);
			if (!target) return;
			event.preventDefault();
			if (location.hash !== hash) history.pushState(null, "", hash);
			const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
			const offset = hash === "#top" ? 0 : nav.getBoundingClientRect().height + 16;
			const lenis = window.siteMotion?.lenis;
			if (lenis) {
				// Lenis already applies the root's scroll-padding-top to element targets.
				lenis.scrollTo(hash === "#top" ? 0 : target, { duration: reduced ? 0 : 0.6, immediate: reduced });
			} else {
				window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - offset, behavior: reduced ? "instant" : "smooth" });
			}
			if (hash === "#top") {
				setTimeout(() => nav.classList.remove("site-nav--visible"), reduced ? 0 : 700);
			}
		});
	});
}

// Vercel Web Analytics + Speed Insights native loader.
// Injects Vercel's first-party scripts without the npm packages.

type MetricsFn = (...args: unknown[]) => void;

const w = window as unknown as {
	va?: MetricsFn;
	vaq?: unknown[];
	si?: MetricsFn;
	siq?: unknown[];
};

w.va = w.va ?? ((...args: unknown[]) => (w.vaq ??= []).push(args));
w.si = w.si ?? ((...args: unknown[]) => (w.siq ??= []).push(args));

const appendMetricScript = (src: string, dataset: Record<string, string>) => {
	if (document.head.querySelector(`script[src="${src}"]`)) return;

	const script = document.createElement("script");
	script.src = src;
	script.defer = true;

	for (const [key, value] of Object.entries(dataset)) {
		script.dataset[key] = value;
	}

	document.head.append(script);
};

appendMetricScript("/_vercel/insights/script.js", {
	sdkn: "@vercel/analytics/astro",
	sdkv: "2.0.1",
});

appendMetricScript("/_vercel/speed-insights/script.js", {
	sdkn: "@vercel/speed-insights/astro",
	sdkv: "2.0.0",
	route: window.location.pathname,
});

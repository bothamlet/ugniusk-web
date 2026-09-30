export interface Project {
	code: string;
	title: string;
	slug: string;
	discipline: string;
	year: string;
	summary: string;
	type: string;
	stack: string[];
	status: string;
	image?: string;
	gallery?: string[];
	imageAlt?: string;
	ogImage?: string;
	galleryAlt?: string[];
	technical?: string;
	noPage?: boolean;
	/** Kept in the data but excluded site-wide: listings, page generation, sitemap. */
	hidden?: boolean;
	reflection: string;
	reflectionBody?: string;
	reflectionTitle?: string;
	sections: {
		label: string;
		body: string;
	}[];
}

const allProjects: Project[] = [
	{
		code: "UG-006",
		title: "Today's Brief",
		slug: "todays-brief",
		discipline: "AI Engineering",
		year: "2026",
		summary:
			"A newspaper that builds itself every morning - roughly twenty news feeds read overnight, clustered, filtered, and delivered to a phone before the day starts.",
		type: "AI Engineering",
		stack: ["Python", "DeepSeek", "SQLite", "Telegram Bot API"],
		status: "Active",
		technical:
			"Ten steps run in sequence under one shell script: discovery, clustering, classification, tracking, coverage, then the beats - Europe, Sports, Stats, Lietuva, and Tech. Discovery reads a fixed roster of newsroom RSS feeds rather than an aggregator API, because a key-free feed cannot be rate limited, run out of quota, or silently decide an outlet does not exist. Clustering is deliberately lexical - titles are stopworded and merged on Jaccard similarity - so the model is only asked to judge, never to merge.\n\nDeepSeek classifies each headline for significance, and the coverage step calls it once per high-significance story to separate \"another day of the same war\" from \"the same story\". SQLite holds every story the pipeline has seen, which is the only way a briefing can say whether something is new or already on its third day.",
		reflection:
			"Today's Brief is a personal morning paper, assembled overnight and read on one phone - world news, the beats that matter, and coverage compared across the political spectrum.",
		reflectionTitle: "A newspaper with one subscriber",
		reflectionBody:
			"I wanted the thing I actually read in the morning to be something I had made, and to be honest about what it was. It runs on a timer on my laptop, so it only happens when the laptop is awake, and it reads only feeds that will still be there tomorrow.\n\nMost of what I learned was about the failure modes, not the features. DeepSeek reasons by default and bills that reasoning against the output budget, which quietly returned empty content on about 40% of calls until I turned thinking off - one production run misclassified seven of twelve articles. The morning the laptop woke at 07:02 with no network taught me that systemd's network-online target is satisfied at boot and means nothing after a resume. A failed run now delivers yesterday's paper with a warning rather than delivering nothing, because the one morning something breaks should not be the one morning with nothing to read.",
		sections: [
			{
				label: "Overview",
				body:
					"One issue a day, split into beats: <strong>World</strong>, <strong>Europe</strong>, <strong>Lietuva</strong>, <strong>Tech</strong>, <strong>Sports</strong>, <strong>Stats</strong>, <strong>Other</strong>, and <strong>For You</strong>. High-significance stories carry coverage from left, centre, and right outlets side by side, so the lean is visible rather than implied. Stories the pipeline has seen before are marked developing with the day they started.",
			},
			{
				label: "Key features",
				body:
					"<strong>Significance filtering</strong>, so the paper is a shortlist and not a feed. <strong>Cross-lean coverage</strong> gathered from a fixed roster of two left, two centre, and two right outlets, matched locally on keywords. <strong>Story memory</strong> in SQLite for developing-story tracking. <strong>One self-contained file</strong> - stylesheet, scripts, data, and fonts inlined, so it opens offline from a chat with no server anywhere.",
			},
			{
				label: "Technical",
				body:
					"Written in Python with no framework - each step reads one JSON file and writes the next, so any step can be resumed or rerun alone. The model client is one shared module, because five copies of the same POST meant five places to apply the same fix. The bundled paper is rendered to a front-page image for the notification itself, and delivered by a systemd timer that fires on the next wake if the machine was asleep at seven. A lock stops a manual run from interleaving with the scheduled one, and the files the page reads are snapshotted and restored together if a run fails part-way.",
			},
		],
	},
	{
		code: "UG-001",
		title: "This Site",
		slug: "this-site",
		discipline: "Web Design & Engineering",
		year: "2026",
		summary:
			"An ongoing experiment in what a personal site can be, based on the original works of Ugnius Liberman.",
		type: "Web Design & Engineering",
		stack: ["Astro", "Anime.js", "Lenis", "Tailwind CSS"],
		status: "Active",
		image: "/screenshots/this-site-card.webp",
		ogImage: "/og/this-site-card.png",
		imageAlt: "This Site homepage - the selected work carousel and editorial intro",
		gallery: [
			"/screenshots/this-site-card.webp",
			"/screenshots/this-site-overview.webp",
			"/screenshots/this-site-detail.webp",
		],
		galleryAlt: [
			"This Site homepage - the selected work carousel and editorial intro",
			"This Site - the editorial statement section with the photography-led layout",
			"This Site - a project page with the technical column and reflection",
		],
		technical:
			"The motion layer is hand-rolled rather than framework-driven - Lenis for scroll physics, Anime.js for reveal transitions, a custom blend-mode cursor, and a hand-written text-scramble effect.",
		reflection:
			"This site is a personal portfolio and journal - a place for design and engineering work, and for the photography that sits alongside it.",
		reflectionTitle: "A dream, finally given a home",
		reflectionBody:
			"This site is a long-held dream finally given a home - a place where my strangest projects could live out in the open. It was a challenge in design and in technical execution, and the most fun I've had making anything. I kept asking what the website of a person should evoke, so it carries my photography as much as it carries my work. Writing about myself in third person added a kind of fun mystery - like composing an obituary for someone I might, one day, be important enough to deserve. There are a dozen directions I want to take it next; for now, the groundwork is solid.",
		sections: [
			{
				label: "Overview",
				body:
					"The references span typography studies, motion design, and deliberate self-mythology - pulled from a dozen different sources and made to sound like one voice.",
			},
			{
				label: "Technical",
				body:
					"Built on Astro's islands architecture for static delivery with zero shipped JavaScript by default. Tailwind CSS v4 handles the design system, TypeScript runs end to end, and the site deploys to Vercel with analytics and speed insights turned on.",
			},
		],
	},
	{
		code: "UG-002",
		title: "Chap",
		slug: "chap",
		discipline: "Mobile Development",
		year: "2026",
		summary:
			"An Android budgeting app that automates entry while keeping you in full control.",
		type: "Mobile Development",
		stack: ["Kotlin", "Jetpack Compose", "Room", "SQLCipher"],
		status: "Paused",
		image: "/chap-card-full.webp",
		ogImage: "/og/chap-card-full.png",
		imageAlt: "Chap - the budgeting app on an iPhone and MacBook, showing envelope balances on the dashboard",
		technical:
			"Data stays local-first and encrypted at rest, with Room running on a SQLCipher database and backups sealed with AES-GCM keys held in the Android Keystore. The CSV pipeline sniffs headers, stages drafts for human review, and auto-tags transactions through user-defined matching rules.\n\nEvery screen was implemented against a hand-made HTML mock that lives in the repo, so the visual contract is versioned like code.",
		reflection:
			"Budget is a native Android envelope-budgeting app built to run itself - transactions arrive from imports, bank connections, and receipts instead of manual entry, and only genuinely ambiguous cases surface for a decision. Everything else gets filed without you ever touching it.",
		reflectionTitle: "Friction is the enemy",
		reflectionBody:
			"Every budgeting app I'd used added friction instead of removing it. I wanted something to set and forget, fully automated, with analytics that were actually intuitive and informative. So I built it on a local-only philosophy from the start, and wrapped it in a calm, polished purple interface, because managing money should feel easy.",
		sections: [
			{
				label: "Overview",
				body:
					"Categorization rules are set once and applied automatically after that, so the same decision never has to be made twice. Everything stays local by default, encrypted at rest, with a full export whenever the data needs to go somewhere else.",
			},
			{
				label: "Technical",
				body:
					"Built natively for Android - Kotlin, Jetpack Compose, and Material 3. Dependency injection is wired through Koin, and the whole app sits behind a biometric gate.",
			},
		],
	},
	{
		code: "UG-003",
		title: "JUKdata",
		slug: "jukdata",
		discipline: "Web Design & Engineering",
		year: "2026",
		summary:
			"A fictional case study. A corporate website for an imaginary Lithuanian data solutions firm.",
		type: "Web Design & Engineering",
		stack: ["Next.js", "React", "TypeScript", "Tailwind CSS"],
		status: "Completed",
		image: "/jukdata-card.webp",
		ogImage: "/og/jukdata-card.png",
		imageAlt: "JUKdata - corporate website homepage with a warm orange hero",
		gallery: [
			"/jukdata-card.webp",
			"/images/projects/jukdata-2.webp",
			"/images/projects/jukdata-3.webp",
		],
		galleryAlt: [
			"JUKdata - corporate website homepage with a warm orange hero",
			"JUKdata - the services section with technology breakdowns",
			"JUKdata - the technologies and case studies section",
		],
		technical:
			"A WebGL simplex-noise shader reacts to the cursor over a hand-written canvas fallback. Scroll reveals run on Motion. The technology ticker is pure CSS. Reduced-motion users get a static, no-JavaScript render.",
		reflection:
			"JUKdata is a fictional corporate site for an imaginary Lithuanian data solutions firm - built to see whether a technical service industry could be presented with real warmth.",
		reflectionTitle: "Warming up the data",
		reflectionBody:
			"Data science is cold by default. The challenge was translating that into something human and inviting: warm, smooth, and unhurried, like a well-aged brandy rather than a dashboard. I anchored the site in a warm orange, built a polished hero to carry the tone, and paired modern type with soft, rounded letterforms. The whole thing settles into something closer to serenity and prestige.",
		sections: [
			{
				label: "Overview",
				body:
					"The site walks through services, technology, and case studies, the way a real B2B firm would present itself to a prospective client.",
			},
			{
				label: "Key features",
				body:
					"Complete product - services, case studies, technology breakdowns, and a contact flow, built out fully.",
			},
			{
				label: "Technical",
				body:
					"Built on the Next.js App Router and exported as a fully static site - React 19 renders server-side, TypeScript runs end to end, and Tailwind CSS v4 handles the design system. Cookie consent is managed through Google Tag Manager with GDPR-default analytics gates.",
			},
		],
	},
	{
		code: "UG-004",
		title: "Inner Council",
		slug: "inner-council",
		discipline: "AI Engineering",
		year: "2026",
		summary:
			"A private, local AI council - five personas built to argue, judge, and question one person. Fully offline, grounded in the literature that shapes each voice.",
		type: "AI Engineering",
		stack: ["Python", "Gemma 4", "ChromaDB", "KoboldCPP"],
		status: "Active",
		hidden: true,
		image: "/images/projects/inner-council-card.webp",
		imageAlt: "Inner Council - a dark card listing the five voices: General, Moralist, Philosopher, Muse, and Old Man",
		technical:
			"Before the voices speak, a low-temperature Archivist call classifies the message, extracts what was actually said, and writes a retrieval query per voice; those queries pull grounding passages from an indexed corpus of Nietzsche, Marcus Aurelius, Plato, Wittgenstein, and Chekhov. Each voice answers with a strict persona prompt, its own temperature, and an [src]/[own] citation marker, so the council can only quote what it actually read.",
		reflection:
			"The council was built to see one person clearly - five voices, each with a bookcase and an opinion, all of them local and all of them private.",
		reflectionTitle: "Five voices, one mirror",
		reflectionBody:
			"Inner Council started as a way to gain perspective on myself - not through advice, but through being seen. Each voice was formed by the books behind it: the General tracks commitments against Marcus Aurelius, the Moralist delivers verdicts with Nietzsche's weight, the Philosopher presses assumptions in Plato's and Wittgenstein's register, and the Old Man speaks in Chekhov's quiet observations. The Archivist decides who needs to hear what. Nothing is cloud-based, nothing is shared - the whole system runs on my machine, which makes it the most honest thing I've built. It argues about me, not to anyone else.",
		sections: [
			{
				label: "Overview",
				body:
					"<strong>Inner Council</strong> is a personal AI experiment: five voices - a <strong>General</strong> who tracks commitments, a <strong>Moralist</strong> who delivers verdicts, a <strong>Philosopher</strong> who destabilizes assumptions, a <strong>Muse</strong> who paints feelings into images, and an <strong>Old Man</strong> who notices patterns. An <strong>Archivist</strong> layer reads each message, decides who needs to hear what, and fetches grounding passages before the voices answer. The whole thing runs <strong>fully local</strong> - a private council that argues about you, not to anyone else.",
			},
			{
				label: "Key features",
				body:
					"Five strict personas, each with its own system prompt, temperature, and output budget. <strong>Archivist orchestration</strong> - message classification, extraction, and per-voice retrieval queries. <strong>ChromaDB retrieval</strong> grounded in an indexed corpus of philosophy and literature. <strong>Citation markers</strong> ([src]/[own]) so the council only quotes what it read. Runs <strong>entirely offline</strong> on a local LLM.",
			},
			{
				label: "Technical",
				body:
					"Built in Python against KoboldCPP's generate API, model-agnostic by design - any GGUF-compatible model can sit behind it, currently running Gemma 4 locally on port 5001. ChromaDB handles retrieval with MiniLM sentence embeddings, structured-output parsing runs the Archivist, and turn-format prompts have their thinking blocks stripped before a response is shown.",
			},
		],
	},
	{
		code: "UG-005",
		title: "Surface Runoff Model",
		slug: "surface-runoff",
		discipline: "Mathematical Modeling",
		year: "2025",
		summary:
			"A Python simulation of surface runoff across a digital elevation grid, using a diffusion wave model.",
		type: "Mathematical Modeling",
		stack: ["Python", "NumPy", "Plotly", "Matplotlib"],
		status: "Completed",
		image: "/images/projects/surface-runoff-card.webp",
		imageAlt:
			"Surface Runoff Model - simulated water depth spreading across a digital elevation grid",
		technical:
			"The core is a fixed-timestep loop over a 50×50 grid. Rainfall is injected per cell from a Gaussian storm that moves deterministically across the terrain; infiltration is limited by both available surface water and remaining soil capacity, and saturation is hard-capped to keep floating-point overshoot out of the water balance. Each frame is rendered twice - once for water depth, once for soil saturation - then stitched into looping GIFs with imageio.",
		reflection:
			"This lab models surface runoff - the process by which rain becomes overland flow, once soil can't absorb any more water.",
		reflectionTitle: "Standing on the shoulders of giants",
		reflectionBody:
			"This was my first real detour into physics outside the curriculum, and it caught me off guard. Surface runoff sounds almost trivial - rain falls, water moves downhill - until you actually look at the equations behind it and realize entire careers were spent getting that \"obvious\" behavior right. There's something humbling about a subject that niche existing at all.\n\nReading about it wasn't enough. I wanted to recreate it - to take equations built by people much smarter than me and see if I could get water to behave the way it behaves in the real world, on a grid, in Python. The result was more than the assignment asked for, but that was the point. It was an experiment, and it worked.",
		sections: [
			{
				label: "Overview",
				body:
					"It uses the Diffusion Wave model, a simplified form of the full Saint-Venant equations that drops inertia but keeps gravity and friction - accurate enough for this scale of simulation, and considerably simpler to implement correctly.",
			},
			{
				label: "Key features",
				body:
					"The model tracks rainfall intensity, duration, and total amount against elevation and a single infiltration rate. It deliberately leaves out soil type, vegetation, land use, basin shape, and drainage networks - real factors, cut to keep the scope lean and within reason.",
			},
			{
				label: "Technical",
				body:
					"Implemented in Python inside a Jupyter notebook - NumPy for the grid math, Plotly for an interactive 3D heightmap, and Matplotlib for the animated frames.",
			},
		],
	},
];

export const projects = allProjects.filter((project) => !project.hidden);

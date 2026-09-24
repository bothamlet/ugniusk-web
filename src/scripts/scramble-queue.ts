/**
 * Pure queue builder for the text scramble effect.
 * Determines when each character settles (start/end frames) - no DOM here.
 */

export interface QueueItem {
	from: string;
	to: string;
	start: number;
	end: number;
}

export const SCRAMBLE_CHARS = "@#$%&*<>{}[]~^=+?";

export const buildScrambleQueue = (
	text: string,
	scrambleLen: number,
): QueueItem[] => {
	const length = text.length;
	const stableLen = Math.max(0, length - scrambleLen);
	const queue: QueueItem[] = [];

	for (let i = 0; i < length; i++) {
		if (i < stableLen) {
			// Stable characters - no scramble
			queue.push({ from: text[i] || "", to: text[i] || "", start: 0, end: 0 });
			continue;
		}

		// Scrambling characters - leftmost settles first (posInScramble=0 first)
		const posInScramble = i - stableLen; // 0 = first scramble char, (scrambleLen-1) = last char
		const baseStart = 18 + posInScramble * 10;
		const baseDuration = 12 + posInScramble * 6;
		const randomOffset = Math.floor(Math.random() * 6);

		queue.push({
			from: text[i] || "",
			to: text[i] || "",
			start: baseStart + randomOffset,
			end: baseStart + randomOffset + baseDuration + Math.floor(Math.random() * 6),
		});
	}

	return queue;
};

/** OTOCLAW terminal color palette — crimson/red accent, dark-terminal-first. */
export const THEME = {
	accent: "#e0483a",
	accentBright: "#ff6b57",
	ok: "#39d97a",
	error: "#e0483a",
	dim: "gray",
} as const;

/** Formats a unix-ms timestamp as `HH:MM:SS` for log-line prefixes. */
export function formatClock(ts: number): string {
	const d = new Date(ts);
	const pad = (n: number): string => n.toString().padStart(2, "0");
	return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** Assigns a unique single-letter keyboard shortcut to each option label. */
export function assignShortcuts(labels: string[]): string[] {
	const used = new Set<string>();
	const fallback = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
	return labels.map((label) => {
		const words = label.split(/\s+/);
		for (const word of words) {
			const letter = word[0]?.toUpperCase();
			if (letter && /[A-Z0-9]/.test(letter) && !used.has(letter)) {
				used.add(letter);
				return letter;
			}
		}
		for (const ch of label.toUpperCase()) {
			if (/[A-Z0-9]/.test(ch) && !used.has(ch)) {
				used.add(ch);
				return ch;
			}
		}
		for (const ch of fallback) {
			if (!used.has(ch)) {
				used.add(ch);
				return ch;
			}
		}
		return "?";
	});
}

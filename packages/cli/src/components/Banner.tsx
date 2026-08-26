import { Text } from "ink";
import { useState } from "react";
import { formatClock, THEME } from "../theme";

// Branding version shown in the terminal banner, independent of the package's semver.
const APP_VERSION = "1.0.0";

export function Banner(): React.JSX.Element {
	const [ts] = useState(() => Date.now());
	return (
		<>
			<Text>
				<Text color={THEME.accent}>[{formatClock(ts)}] </Text>
				<Text bold>otoclaw AI Agent Terminal v{APP_VERSION}</Text>
			</Text>
			<Text>
				<Text color={THEME.accent}>[{formatClock(ts)}] </Text>
				<Text bold>sistem başlatılıyor... </Text>
				<Text color={THEME.ok}>✓</Text>
			</Text>
		</>
	);
}

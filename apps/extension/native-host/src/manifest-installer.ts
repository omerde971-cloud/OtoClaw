/**
 * Generates the Chrome native messaging host manifest and registers it with the OS so Chrome
 * can find this native host. This is infrastructure only — Phase 6 (packaging) is responsible
 * for actually invoking `install()` during app install; it must never be called automatically
 * from daemon/server startup.
 */

const NATIVE_HOST_NAME = "com.otoclaw.bridge";

export interface NativeMessagingManifest {
	name: string;
	description: string;
	path: string;
	type: "stdio";
	allowed_origins: string[];
}

export function buildManifest(hostExecutablePath: string, extensionId: string): NativeMessagingManifest {
	return {
		name: NATIVE_HOST_NAME,
		description: "OtoClaw Bridge native messaging host",
		path: hostExecutablePath,
		type: "stdio",
		allowed_origins: [`chrome-extension://${extensionId}/`],
	};
}

/**
 * Windows registration: Chrome reads the manifest path from a registry key rather than a
 * fixed directory. Callers pass a `writeRegistryValue` shim so this stays testable without
 * touching the real registry (the CLI entry point supplies the real implementation).
 */
export async function installOnWindows(
	manifest: NativeMessagingManifest,
	manifestPath: string,
	writeManifestFile: (path: string, contents: string) => Promise<void>,
	writeRegistryValue: (keyPath: string, valueName: string, value: string) => Promise<void>,
): Promise<void> {
	await writeManifestFile(manifestPath, JSON.stringify(manifest, null, 2));
	const keyPath = `HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\${NATIVE_HOST_NAME}`;
	await writeRegistryValue(keyPath, "(Default)", manifestPath);
}

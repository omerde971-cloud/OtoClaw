#!/usr/bin/env sh
# otoclaw installer for macOS/Linux — intended usage:
#   curl -fsSL <release-url>/install.sh | sh
#
# TODO: gerçek repo yayınlandığında bu URL güncellenmeli (proje henüz yayınlanmadı — bu
# betik şimdilik yalnızca iskelet: gerçek bir indirme adresi yok, aşağıdaki
# GITHUB_RELEASES_URL bir placeholder).
set -eu

GITHUB_RELEASES_URL="${OTOCLAW_RELEASES_URL:-https://github.com/OWNER/otoclaw/releases/latest/download}"
INSTALL_DIR="${OTOCLAW_INSTALL_DIR:-$HOME/.otoclaw/bin}"

fail() {
	echo "otoclaw install: $1" >&2
	exit 1
}

detect_target() {
	os="$(uname -s)"
	arch="$(uname -m)"
	case "$os" in
	Linux) plat="linux" ;;
	Darwin) plat="darwin" ;;
	*) fail "unsupported OS: $os" ;;
	esac
	case "$arch" in
	x86_64 | amd64) carch="x64" ;;
	arm64 | aarch64) carch="arm64" ;;
	*) fail "unsupported architecture: $arch" ;;
	esac
	echo "${plat}-${carch}"
}

main() {
	command -v curl >/dev/null 2>&1 || fail "curl is required"

	target="$(detect_target)"
	mkdir -p "$INSTALL_DIR"

	echo "otoclaw install: downloading otoclaw (${target})..."
	cli_url="${GITHUB_RELEASES_URL}/otoclaw-${target}"
	daemon_url="${GITHUB_RELEASES_URL}/otoclaw-daemon-${target}"

	tmp_cli="$(mktemp)"
	tmp_daemon="$(mktemp)"
	trap 'rm -f "$tmp_cli" "$tmp_daemon"' EXIT

	curl -fsSL "$cli_url" -o "$tmp_cli" || fail "download failed: $cli_url (project has no published releases yet — see TODO in this script)"
	curl -fsSL "$daemon_url" -o "$tmp_daemon" || fail "download failed: $daemon_url"

	install -m 0755 "$tmp_cli" "$INSTALL_DIR/otoclaw"
	install -m 0755 "$tmp_daemon" "$INSTALL_DIR/otoclaw-daemon"

	echo "otoclaw install: installed to $INSTALL_DIR"
	case ":$PATH:" in
	*":$INSTALL_DIR:"*) ;;
	*)
		echo "otoclaw install: add this to your shell profile to use 'otoclaw' directly:"
		echo "  export PATH=\"$INSTALL_DIR:\$PATH\""
		;;
	esac
}

main "$@"

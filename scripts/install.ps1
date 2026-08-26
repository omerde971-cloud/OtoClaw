# otoclaw installer for Windows — intended usage:
#   irm <release-url>/install.ps1 | iex
#
# TODO: gercek repo yayinlandiginda bu URL guncellenmeli (proje henuz yayinlanmadi — bu
# betik simdilik yalnizca iskelet: gercek bir indirme adresi yok, asagidaki
# $GithubReleasesUrl bir placeholder).
$ErrorActionPreference = "Stop"

$GithubReleasesUrl = if ($env:OTOCLAW_RELEASES_URL) { $env:OTOCLAW_RELEASES_URL } else { "https://github.com/OWNER/otoclaw/releases/latest/download" }
$InstallDir = if ($env:OTOCLAW_INSTALL_DIR) { $env:OTOCLAW_INSTALL_DIR } else { Join-Path $env:USERPROFILE ".otoclaw\bin" }

function Get-Target {
	$arch = $env:PROCESSOR_ARCHITECTURE
	switch ($arch) {
		"AMD64" { return "windows-x64" }
		"ARM64" { return "windows-arm64" }
		default { throw "unsupported architecture: $arch" }
	}
}

function Main {
	$target = Get-Target
	New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null

	Write-Host "otoclaw install: downloading otoclaw ($target)..."
	$cliUrl = "$GithubReleasesUrl/otoclaw-$target.exe"
	$daemonUrl = "$GithubReleasesUrl/otoclaw-daemon-$target.exe"

	$cliDest = Join-Path $InstallDir "otoclaw.exe"
	$daemonDest = Join-Path $InstallDir "otoclaw-daemon.exe"

	try {
		Invoke-WebRequest -Uri $cliUrl -OutFile $cliDest -UseBasicParsing
		Invoke-WebRequest -Uri $daemonUrl -OutFile $daemonDest -UseBasicParsing
	}
	catch {
		throw "download failed (project has no published releases yet — see TODO in this script): $_"
	}

	Write-Host "otoclaw install: installed to $InstallDir"
	$pathEntries = $env:Path -split ";"
	if ($pathEntries -notcontains $InstallDir) {
		Write-Host "otoclaw install: add this directory to your PATH to use 'otoclaw' directly:"
		Write-Host "  $InstallDir"
	}
}

Main

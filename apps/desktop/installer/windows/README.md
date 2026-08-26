# OtoClaw Windows Installer

Builds an unsigned Windows installer for the OtoClaw desktop app using
[Inno Setup](https://jrsoftware.org/isinfo.php).

## Prerequisites

1. Flutter SDK with the Windows desktop target enabled.
2. Inno Setup Compiler (`iscc`) installed and on `PATH`. Download from
   https://jrsoftware.org/isinfo.php (Inno Setup 6+).

## Build steps

From the repo root:

```sh
cd apps/desktop
flutter build windows
```

This produces the release build at
`apps/desktop/build/windows/x64/runner/Release`.

Then compile the installer:

```sh
cd apps/desktop/installer/windows
iscc otoclaw.iss
```

The compiled installer is written to
`apps/desktop/installer/windows/Output/OtoClaw-Setup.exe`.

## Notes

- The app is not code-signed, so Windows SmartScreen will warn on first run.
- `AppVersion` in `otoclaw.iss` must be kept in sync with `version:` in
  `apps/desktop/pubspec.yaml`.

# @otoclaw/website

The public landing page for OtoClaw. Plain HTML/CSS, no framework.

## Local preview

```sh
bun run build
```

This copies `src/` into `dist/`. Open `dist/index.html` directly in a browser,
or serve the folder with any static file server, e.g.:

```sh
bunx serve dist
```

## Testing

```sh
bun run test
```

Renders `src/index.html` with Playwright and asserts the hero, features, and
download sections mount without console errors.

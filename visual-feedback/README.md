# Visual Feedback Loop

This folder is for repeatable UI screenshot reviews.

## Files

- `targets.json`: routes captured by Playwright
- `captures/`: screenshot output for each review run
- `captures/latest.txt`: label of the most recent run
- `current/`: stable location for the latest review bundle

## Commands

Start the app first, or let Playwright reuse the existing server.

```bash
npm run dev
```

Capture all configured routes in both desktop and mobile layouts:

```bash
npm run capture:visual
```

Capture by state name and refresh `visual-feedback/current`:

```bash
npm run review:capture -- home
```

Capture multiple states into the stable `current` bundle:

```bash
npm run review:capture -- home local online
```

Capture desktop only:

```bash
npm run capture:visual:desktop
```

Capture mobile only:

```bash
npm run capture:visual:mobile
```

Capture a subset of routes with a custom run label:

```bash
npx cross-env VISUAL_CAPTURE_LABEL=round-02 VISUAL_CAPTURE_TARGETS=home,local npm run capture:visual
```

## Review Loop

1. Run a capture command.
2. If you want stable paths, use `npm run review:capture -- <state> ...`.
3. Check images under `visual-feedback/current/desktop/` and `visual-feedback/current/mobile/`.
4. Ask Codex to review a state such as `home` or `online`.
5. Apply UI changes.
6. Repeat the capture.

Codex can review local screenshots after you provide the full path, for example:

`c:\Users\shuka\Documents\hit_and_blow\visual-feedback\captures\20260315-180500\desktop\home.png`

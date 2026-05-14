# ESADAR mobile Chrome footer/header stability patch

## Files changed

- `frontend/src/components/FooterScrollScene.jsx`
- `frontend/src/index.css`

## What it changes

- Reverts the aggressive mobile footer full-screen overlay behavior that caused Chrome mobile flicker.
- Keeps the footer in the classic behind-the-page reveal on mobile/tablet.
- Stops listening to `visualViewport` resize/scroll for the footer reveal calculation, because Chrome mobile fires those events while the browser UI bar moves and can cause repeated repaint toggles.
- Delays `app-shell--footer-scroll-deep` on compact viewports until the user is essentially at the bottom of the page.
- Keeps the header painted behind the intro splash instead of hiding it. The splash still covers it, but the header is already ready when the splash fades, avoiding the delayed header appearance.

## Validation

```bash
cd frontend
npm run build
```

Result: build OK.

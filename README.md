# GALACTIC COACH (working title)

Text-based, low-fi intergalactic college basketball management. See `DESIGN.md`
for the full vision.

## Play it

```sh
npm install   # first time only
npm run dev   # then open the printed localhost URL
```

Progress auto-saves in the browser (localStorage). "NEW GAME" wipes it.

## Code layout

- `src/engine/` — the whole game simulation, plain TypeScript, zero DOM.
  This is the part that later gets wrapped for Steam / mobile / itch.io.
- `src/main.ts` + `src/style.css` — the throwaway-able text UI.

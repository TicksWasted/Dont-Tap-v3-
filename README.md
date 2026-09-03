# donttap v2

Based on https://github.com/Sentero-esp12/donttap-2019

## Local changes
- Hitsounds use a small audio pool so fast taps don't cut each other off
- Clicks off the 4x4 grid are ignored (no accidental miss)
- Settings / Colors panels no longer restart a run when you press a key
- Escape closes panels; optional Space-only start
- End-of-run line shows CPS, max multiplier, and hit count
- Pointer events (mouse + touch) and a short hit flash on Frenzy tiles
- New personal best flashes the hi-score
- Viewport meta for mobile / Electron scaling

Open `index.html` in a browser, or `npm start` with Electron.

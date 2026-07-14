# 5x5 Last Two Edges Trainer

A local browser version of the 5x5 L2E trainer. It includes all 12 cases from
the supplied algorithm sheet, randomized state-preserving setup moves, a timer,
manual time entry, filters, and per-case statistics.

Solve history and the selected filter are stored only in this browser using
`localStorage`. No server or account is required.

## Requirements

- Node.js 20 or newer
- npm (included with Node.js)

Check that they are installed:

```bash
node --version
npm --version
```

If Node.js is missing, install the current LTS release from <https://nodejs.org/>.

## Run locally

Open Terminal and run:

```bash
cd "/Users/vijayv/Personal/Vijay/L2E-Trainer-Browser"
npm install
npm run dev
```

Open the local address printed by Vite, normally:

<http://localhost:5173>

Stop the development server by pressing `Control-C` in Terminal.

## Production build

To check and build the optimized browser version:

```bash
npm run build
npm run preview
```

The generated static files are written to `dist/`.

## Reset saved data

Use **Clear all history** in the statistics drawer. You can also clear this
site's local browser storage from the browser's developer tools.

## Important notation

- `Rw`, `Lw`, and similar moves are wide turns.
- A leading number such as `3Rw` means three layers.
- `x`, `y`, and `z` are whole-cube rotations and must be performed.
- Moves ending in `'` are counterclockwise; moves ending in `2` are half turns.

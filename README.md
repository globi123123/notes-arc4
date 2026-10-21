# playground.

A small library of original browser games with a calm, editorial look: deep charcoal or warm off-white surfaces, soft type and a terracotta accent, with a dark and a light theme. Everything runs in the browser as a static site. There is no backend, no account and no tracking. Favorites and records are kept in `localStorage` on the player's device.

The site opens on the game library. From there players can browse categories, search, mark favorites and launch any game. Every game uses the same page layout with a back link, stats, controls, pause/restart and a "play something else" section.

## Games

| Game          | Category         | What it is                                                                                                          |
| ------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------- |
| Snake         | Classics         | Grid snake with smooth movement, speeds up as it grows                                                              |
| Block Stacker | Classics         | Falling-block puzzle with ghost piece, next preview, levels, soft/hard drop                                         |
| 2048          | Classics, Brain  | Sliding tiles with animations; the board is saved between visits                                                    |
| Minesweeper   | Classics, Brain  | Three sizes, safe first click, flags, chording, long-press and keyboard play                                        |
| Breakout      | Classics, Arcade | Five brick layouts, two-hit bricks, lives, mouse/touch/keyboard paddle                                              |
| Pong          | Classics         | First to seven against a computer paddle with three skill levels                                                    |
| Updraft       | Arcade           | One-button paper glider through columns                                                                             |
| Lane Splitter | Racing, Arcade   | Top-down motorcycle ride through traffic with throttle, brake, near-miss combos, lane-changing cars, cones and oil  |
| Asteroid Belt | Arcade           | Rotate, thrust and shoot through waves of splitting rocks                                                           |
| Dune Runner   | Arcade           | Endless runner with variable jump height, ducking and birds                                                         |
| Aim Trainer   | Arcade           | 30 or 60 second rounds of shrinking targets with accuracy and reaction time                                         |
| Word Rain     | Brain            | Falling-words typing game with WPM, accuracy, lives and levels                                                      |
| Pairs         | Brain            | Memory cards in three board sizes                                                                                   |
| Sudoku        | Brain            | Generated puzzles with exactly one solution, three difficulties, notes, undo, conflict highlighting, saved progress |
| Reaction Time | Brain            | Five-try reaction test with false-start detection                                                                   |
| Echo          | Brain            | Repeat a growing sequence of lit tiles, optional sound                                                              |

All games are original implementations with their own artwork drawn in code (canvas, SVG or CSS).

## Technology

- Plain HTML, CSS and JavaScript (ES modules). No framework and no build step: the `site/` folder is the finished website.
- Hash-based routing (`#/`, `#/play/<id>`) so the site works from any base path, including GitHub Pages project sites.
- [Inter](https://rsms.me/inter/) (variable, Latin subset) is self-hosted in `site/fonts/` under the SIL Open Font License.
- Development tools only (not needed to run the site): Node.js 22, ESLint, Prettier, the built-in `node:test` runner and Playwright for browser tests.

## Project structure

```
site/                     the deployable website
  index.html
  css/                    design tokens, base styles, components, library and game page layout
  fonts/                  Inter (woff2) and its license
  js/
    main.js               app entry: header, library, routing between views
    config.js             site name and tagline (rename the site here)
    router.js             hash routes
    state.js              library UI state (category, search)
    data/                 categories and the pure filtering logic
    lib/                  storage, game loop, canvas scaling, input, helpers
    ui/                   header, library, game card, shared game page, icons, thumbnails
    games/
      registry.js         the list of all games and their metadata
      <id>/index.js       one folder per game (plus logic.js / style.css where useful)
scripts/
  serve.mjs               zero-dependency local server
  check-site.mjs          checks references, paths and the game registry
tests/
  unit/                   node:test tests for storage, filtering, routing and game logic
  e2e/smoke.mjs           Playwright tests that play every game in Chromium
.github/workflows/
  pages.yml               deploys site/ to GitHub Pages
  ci.yml                  lint, unit tests, site check and browser tests
```

## Run it locally

The site needs to be served over HTTP (browsers do not load ES modules from `file://`).

```bash
npm install        # dev tools only: ESLint, Prettier, Playwright
npm start          # http://localhost:5173/
```

`npm run start:pages` serves the same files under `http://localhost:5173/notes-arc4/`, which mirrors how GitHub Pages serves this repository. You can also use any other static server pointed at `site/`, for example `python3 -m http.server --directory site`.

## Build

There is no build step. `site/` is exactly what gets deployed. Before publishing, run:

```bash
npm run verify     # lint + unit tests + site check
```

## Tests and checks

| Command                                   | What it does                                                                                                                                   |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run lint`                            | ESLint over the site, scripts and tests                                                                                                        |
| `npm test`                                | Unit tests (storage, filtering, routing, Snake, Block Stacker, 2048, Minesweeper, Sudoku generator, Pairs)                                     |
| `npm run check`                           | Verifies that every referenced file exists, that no URL is root-absolute and that every registered game has its module, stylesheet and artwork |
| `npm run test:e2e`                        | Serves the site under `/notes-arc4/` and drives the library and all 16 games in Chromium (desktop, mobile with touch, reduced motion)          |
| `npm run format` / `npm run format:check` | Prettier                                                                                                                                       |

The browser tests need a Playwright Chromium build once: `npx playwright install chromium`.

## Deploy to GitHub Pages

The repository includes `.github/workflows/pages.yml`. It runs the checks and publishes the `site/` folder.

1. Push the code to the `main` branch (or merge the working branch into `main`).
2. In the repository on GitHub open **Settings → Pages**.
3. Under **Build and deployment → Source** choose **GitHub Actions**.
4. The workflow runs on every push to `main`. You can also start it by hand under **Actions → Deploy to GitHub Pages → Run workflow**.
5. The site is then available at `https://globi123123.github.io/notes-arc4/` (the URL is also shown in the workflow run).

No base-path configuration is needed. All asset paths are relative and navigation uses the URL hash, so the same files work at `https://<user>.github.io/` (user site), `https://<user>.github.io/<repo>/` (project site) and on a custom domain. GitHub's `github-pages` environment only accepts deployments from the default branch by default, so if the workflow is refused, make sure `main` is the default branch or adjust the environment's deployment branch rule.

## Add a game

1. Create `site/js/games/<id>/index.js` and export a default `mount(ctx)` function:

   ```js
   import { createGameCanvas } from '../../lib/canvas.js';
   import { createLoop } from '../../lib/loop.js';
   import { createKeyboard } from '../../lib/input.js';

   export default function mount(ctx) {
     const view = createGameCanvas(ctx, { width: 480, height: 480 });
     const keys = createKeyboard(ctx);
     let score = 0;
     const loop = createLoop({
       update(dt) {
         /* move things, read keys.isDown('left') ... */
       },
       render() {
         /* draw with view.ctx */
       },
     });

     ctx.overlay.show({ title: 'Ready?', actions: [{ label: 'Start', onClick: start }] });

     function start() {
       ctx.overlay.hide();
       ctx.setStatus('running');
       ctx.setStats({ score });
       loop.start();
     }

     return {
       pause: () => loop.stop(),
       resume: () => loop.start(),
       restart: start,
       destroy: () => loop.stop(),
     };
   }
   ```

2. Add an entry to `games` in `site/js/games/registry.js` with the id, title, description, categories, difficulty, controls, stats and `load: () => import('./<id>/index.js')`. Set `styles: true` if the folder contains a `style.css`.
3. Add a card illustration to `site/js/ui/thumbnails.js`.
4. Run `npm run verify`. The site check reports anything that is missing.

The shell takes care of the page layout, the Pause/Restart buttons, pausing when the tab is hidden, the records panel and cleanup. Listeners added with `ctx.listen` and callbacks registered with `ctx.onDestroy` are removed automatically when the player leaves.

Useful parts of `ctx`: `stage`, `toolbar`, `controlsSlot`, `overlay.show/hide`, `setStats`, `setStatus('idle' | 'running' | 'paused' | 'over')`, `storage.getRecord/submitRecord/getPref/setPref`, `showRecords`, `listen`, `onDestroy`.

## Themes

The site has a dark theme (the default for first visits) and a light theme. The round sun/moon button at the right end of the header switches between them instantly, and the choice is remembered in `localStorage` under `playground:theme`.

- All interface colors are CSS variables in `site/css/tokens.css`: `:root` holds the dark palette and `:root[data-theme='light']` the light one. Components and game stylesheets only use these variables, so adjusting a theme means editing one file.
- A short inline script in the `<head>` of `site/index.html` applies the saved theme before the stylesheets paint, so there is no flash of the wrong theme. `site/js/lib/theme.js` handles switching, saving and notifying games.
- Canvas games that draw their own light board (Snake, Block Stacker, Breakout, Pong, Aim Trainer, Word Rain) take their board and text colors from `surfaces()` in `site/js/lib/palette.js` and redraw when the theme changes. Scene games (Updraft, Lane Splitter, Asteroid Belt, Dune Runner) keep their own artwork in both themes.
- If storage is unavailable the site starts in dark mode and the toggle still works for the visit.

## Saved data

Everything except the theme is stored under one `localStorage` key, `playground:v1`:

```json
{
  "version": 1,
  "favorites": ["sudoku"],
  "records": { "snake": { "best": 42 } },
  "prefs": { "pong": { "skill": "hard" } }
}
```

Reads are validated, so corrupted or old data falls back to defaults. If storage is blocked (for example in some private modes) the site keeps working for the current visit. The footer has a "Clear saved data" button, which also forgets the theme choice (the current page keeps its theme until the next visit). No personal information is stored.

## Accessibility and devices

- Layouts adapt from phones to wide screens without horizontal scrolling.
- Visible focus styles, keyboard navigation for categories, cards and the grid games (Minesweeper, Sudoku, Pairs, Echo), and screen reader labels for controls.
- Arrow keys and Space never scroll the page while a game is open, and game shortcuts are ignored while typing in a text field.
- Touch devices get on-screen buttons, swipes, tap and long-press where it makes sense.
- `prefers-reduced-motion` turns off interface transitions, tile animations, particles and screen shake.
- Both themes are designed for readable contrast; the theme toggle has a visible focus ring and an accessible label that says which theme it switches to.

## Known limitations

- Sound is only used in Echo, and it is off by default.
- Very small landscape games (Dune Runner, Pong) are playable on phones but more comfortable in landscape orientation or on larger screens.
- On narrow phones the Intermediate Minesweeper board scrolls inside its frame to keep cells large enough to tap.

#!/usr/bin/env node
/**
 * Browser smoke tests. Serves the site under /notes-arc4/ (like a GitHub
 * Pages project site), then drives the library and every game in Chromium.
 *
 *   npm run test:e2e
 *
 * Needs a Chromium build for Playwright: `npx playwright install chromium`.
 */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { games } from '../../site/js/games/registry.js';
import { solve } from '../../site/js/games/sudoku/logic.js';

const PORT = 5199;
const BASE = `http://localhost:${PORT}/notes-arc4/`;
const root = fileURLToPath(new URL('../..', import.meta.url));

const results = [];
let failures = 0;

async function check(name, fn) {
  const started = Date.now();
  try {
    await fn();
    results.push(`  ok    ${name} (${Date.now() - started} ms)`);
  } catch (error) {
    failures += 1;
    results.push(
      `  FAIL  ${name}\n        ${String(error.message || error)
        .split('\n')
        .join('\n        ')}`,
    );
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(fn, { timeout = 5000, interval = 50, message = 'condition' } = {}) {
  const end = Date.now() + timeout;
  for (;;) {
    const value = await fn();
    if (value) return value;
    if (Date.now() > end) throw new Error(`Timed out waiting for ${message}`);
    await sleep(interval);
  }
}

function startServer() {
  const server = spawn(process.execPath, ['scripts/serve.mjs', '--port', String(PORT), '--base', '/notes-arc4/'], {
    cwd: root,
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  return new Promise((resolve, reject) => {
    server.stdout.once('data', () => resolve(server));
    server.once('error', reject);
  });
}

/** Opens a page that records errors, failed requests and animation frames. */
async function openPage(context) {
  const page = await context.newPage();
  const problems = [];
  page.on('pageerror', (e) => problems.push(`page error: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && problems.push(`console error: ${m.text()}`));
  page.on('response', (r) => r.status() >= 400 && problems.push(`HTTP ${r.status()} ${r.url()}`));
  page.on('requestfailed', (r) => problems.push(`request failed: ${r.url()}`));
  await page.addInitScript(() => {
    window.__frames = 0;
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => {
      window.__frames += 1;
      return raf(cb);
    };
  });
  page.problems = problems;
  return page;
}

const stat = (page, label) =>
  page.evaluate((l) => {
    for (const el of document.querySelectorAll('.game-statbar .stat')) {
      if (el.querySelector('dt').textContent.trim().toLowerCase() === l.toLowerCase())
        return el.querySelector('dd').textContent.trim();
    }
    return null;
  }, label);

// textContent, not innerText: kickers are uppercased with CSS.
const overlayText = (page) => page.evaluate(() => document.querySelector('.stage .overlay')?.textContent ?? '');
const clickOverlayPrimary = (page) => page.click('.stage .overlay .btn-primary');

async function openGame(page, id) {
  await page.goto(`${BASE}#/play/${id}`);
  await page.waitForSelector(`.game-view[data-game="${id}"] .stage`);
  await waitFor(() => page.evaluate(() => !document.querySelector('.game-loading')), { message: `${id} to load` });
  const error = await page.$('.game-error');
  assert(!error, `${id} failed to load`);
}

// ------------------------------------------------------------------ game scripts

const scripts = {
  async snake(page) {
    await page.keyboard.press('ArrowUp');
    await waitFor(() => page.evaluate(() => !document.querySelector('.stage .overlay')), { message: 'snake to start' });
    const scrollBefore = await page.evaluate(() => window.scrollY);
    await page.keyboard.press('ArrowDown'); // reversing is ignored, page must not scroll
    assert((await page.evaluate(() => window.scrollY)) === scrollBefore, 'arrow keys scrolled the page');
    await page.keyboard.press('KeyP');
    assert((await overlayText(page)).includes('Paused'), 'P should pause');
    await page.keyboard.press('KeyP');
    await waitFor(async () => (await overlayText(page)).includes('Game over'), {
      timeout: 6000,
      message: 'snake to hit the wall',
    });
    await clickOverlayPrimary(page);
    assert((await stat(page, 'Score')) === '0', 'restart resets the score');
  },

  async blocks(page) {
    await page.keyboard.press('ArrowUp');
    for (let i = 0; i < 60; i += 1) {
      await page.keyboard.press('Space');
      await sleep(60);
      if ((await overlayText(page)).includes('Game over')) break;
    }
    assert(Number((await stat(page, 'Score')).replace(/,/g, '')) > 0, 'hard drops should score');
    await waitFor(async () => (await overlayText(page)).includes('Game over'), { message: 'stack to reach the top' });
    await clickOverlayPrimary(page);
    assert((await stat(page, 'Score')) === '0', 'restart resets the score');
  },

  async 2048(page) {
    const tiles = () => page.$$eval('.t48-tile', (els) => els.length);
    assert((await tiles()) === 2, 'new game starts with two tiles');
    for (const key of ['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp']) {
      await page.keyboard.press(key);
      await sleep(160);
    }
    assert((await tiles()) > 2, 'moves should add tiles');
    const before = await page.$$eval('.t48-tile', (els) =>
      els
        .map((e) => e.style.cssText + e.dataset.v)
        .sort()
        .join('|'),
    );
    await page.reload();
    await page.waitForSelector('.t48-tile');
    const after = await page.$$eval('.t48-tile', (els) =>
      els
        .map((e) => e.style.cssText + e.dataset.v)
        .sort()
        .join('|'),
    );
    assert(before === after, 'board should be restored after reload');
    await page.click('.game-topbar .btn:has-text("Restart")');
    assert((await tiles()) === 2, 'restart deals a fresh board');
  },

  async minesweeper(page) {
    await page.click('.ms-cell >> nth=40');
    const open = await page.$$eval('.ms-cell.is-open', (els) => els.length);
    assert(open >= 1, 'first click opens cells');
    await waitFor(async () => (await stat(page, 'Time')) !== '0:00', { message: 'timer to run' });
    const hidden = await page.$('.ms-cell:not(.is-open):not(.is-flag)');
    await hidden.click({ button: 'right' });
    assert((await page.$$eval('.ms-cell.is-flag', (e) => e.length)) === 1, 'right-click flags');
    assert((await stat(page, 'Mines')) === '9', 'mine counter follows flags');
    await page.click('.segmented__option:has-text("Expert")');
    assert((await page.$$eval('.ms-cell', (e) => e.length)) === 480, 'expert board has 480 cells');
    await page.click('.segmented__option:has-text("Beginner")');
  },

  async breakout(page) {
    await clickOverlayPrimary(page);
    await page.keyboard.press('Space');
    await page.keyboard.down('ArrowLeft');
    await sleep(500);
    await page.keyboard.up('ArrowLeft');
    await sleep(1200);
    assert(await page.evaluate(() => !document.querySelector('.stage .overlay')), 'ball should be in play');
    await page.click('.game-topbar .btn:has-text("Pause")');
    assert((await overlayText(page)).includes('Paused'), 'pause button pauses');
    await page.click('.stage .overlay .btn:has-text("Resume")');
  },

  async pong(page) {
    await clickOverlayPrimary(page);
    await page.keyboard.down('ArrowUp');
    await sleep(800);
    await page.keyboard.up('ArrowUp');
    await sleep(2500);
    const total = Number(await stat(page, 'You')) + Number(await stat(page, 'Computer'));
    assert(Number.isFinite(total), 'scores are numbers');
    await page.click('.segmented__option:has-text("Hard")');
    assert((await overlayText(page)).includes('First to'), 'changing skill offers a new match');
  },

  async updraft(page) {
    await clickOverlayPrimary(page);
    await page.keyboard.press('Space');
    await waitFor(async () => (await overlayText(page)).includes('Grounded'), {
      timeout: 6000,
      message: 'glider to fall',
    });
    await clickOverlayPrimary(page);
    await page.keyboard.press('Space');
    await sleep(200);
    assert(await page.evaluate(() => !document.querySelector('.stage .overlay')), 'flying again');
  },

  async 'lane-splitter'(page) {
    await clickOverlayPrimary(page);
    await page.keyboard.down('ArrowUp');
    await sleep(1200);
    await page.keyboard.up('ArrowUp');
    const distance = parseFloat(await stat(page, 'Distance'));
    assert(distance > 0, `the bike should travel (distance ${distance})`);
    assert(parseInt(await stat(page, 'Speed'), 10) > 0, 'speed is shown');
    await page.keyboard.press('KeyP');
    assert((await overlayText(page)).includes('Paused'), 'P pauses the ride');
    const frozen = await stat(page, 'Distance');
    await sleep(400);
    assert((await stat(page, 'Distance')) === frozen, 'distance stays still while paused');
    await page.keyboard.press('KeyP');
  },

  async 'asteroid-belt'(page) {
    await clickOverlayPrimary(page);
    await page.keyboard.down('Space');
    await page.keyboard.down('ArrowLeft');
    await sleep(1800);
    await page.keyboard.up('ArrowLeft');
    await page.keyboard.up('Space');
    assert((await stat(page, 'Wave')) === '1', 'wave counter shown');
  },

  async 'dune-runner'(page) {
    await page.keyboard.press('Space');
    await sleep(500);
    assert(Number(await stat(page, 'Score')) > 0, 'running scores points');
    await waitFor(async () => (await overlayText(page)).includes('Tripped'), {
      timeout: 8000,
      message: 'runner to hit an obstacle',
    });
    await clickOverlayPrimary(page);
  },

  async 'aim-trainer'(page) {
    await clickOverlayPrimary(page);
    await sleep(4300);
    const box = await page.$eval('canvas', (c) => {
      const r = c.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    });
    await page.mouse.click(box.x + 5, box.y + box.h - 5);
    assert((await stat(page, 'Accuracy')) !== '–', 'clicks count toward accuracy');
    assert((await stat(page, 'Time')) !== '30s', 'round timer runs');
  },

  async 'word-rain'(page) {
    await clickOverlayPrimary(page);
    await sleep(1600);
    // Find a falling word by typing first letters until a target appears.
    let word = null;
    for (const letter of 'abcdefghijklmnopqrstuvwxyz') {
      await page.fill('.wr-input', '');
      await page.type('.wr-input', letter);
      const target = await page.textContent('.wr-target');
      if (target && !target.includes('No word')) {
        word = target;
        break;
      }
    }
    assert(word, 'a falling word should be targetable');
    await page.fill('.wr-input', '');
    await page.type('.wr-input', word, { delay: 30 });
    await waitFor(async () => Number((await stat(page, 'Score')).replace(/,/g, '')) > 0, {
      message: 'typed word to score',
    });
    assert((await page.inputValue('.wr-input')) === '', 'input clears after a word');
    await page.type('.wr-input', 'zzq');
    assert(await page.$('.wr-input.is-wrong'), 'wrong input is marked');
  },

  async pairs(page) {
    await page.click('.segmented__option:has-text("Small")');
    const count = await page.$$eval('.pairs-card', (e) => e.length);
    assert(count === 12, 'small board has 12 cards');
    const label = (i) => page.getAttribute(`.pairs-card[data-index="${i}"]`, 'aria-label');
    const symbols = {};
    for (let i = 0; i < count; i += 2) {
      await page.click(`.pairs-card[data-index="${i}"]`);
      symbols[i] = (await label(i)).split(', ')[1];
      if (await page.$(`.pairs-card[data-index="${i}"].is-matched`)) continue;
      await page.click(`.pairs-card[data-index="${i + 1}"]`);
      symbols[i + 1] = (await label(i + 1)).split(', ')[1];
    }
    await sleep(1000);
    const bySymbol = {};
    for (const [i, s] of Object.entries(symbols)) (bySymbol[s] ||= []).push(Number(i));
    for (const [a, b] of Object.values(bySymbol)) {
      if (b === undefined || (await page.$(`.pairs-card[data-index="${a}"].is-matched`))) continue;
      await page.click(`.pairs-card[data-index="${a}"]`);
      await page.click(`.pairs-card[data-index="${b}"]`);
    }
    await waitFor(async () => (await overlayText(page)).includes('All pairs found'), {
      message: 'pairs to be completed',
    });
  },

  async sudoku(page) {
    await page.waitForSelector('.sdk-cell.is-given');
    const values = await page.$$eval('.sdk-cell', (els) =>
      els.map((e) => (e.classList.contains('is-given') ? Number(e.textContent) : 0)),
    );
    const { solution, count } = solve(values, { limit: 2 });
    assert(count === 1, 'generated puzzle must have exactly one solution');
    // A wrong entry is flagged as a conflict and can be erased.
    const empty = values.findIndex((v) => !v);
    await page.click(`.sdk-cell[data-i="${empty}"]`);
    const clash = values.find((v, i) => v && Math.floor(i / 9) === Math.floor(empty / 9));
    await page.keyboard.press(`Digit${clash}`);
    assert(await page.$(`.sdk-cell[data-i="${empty}"].is-conflict`), 'conflicting entry is highlighted');
    await page.keyboard.press('Backspace');
    for (let i = 0; i < 81; i += 1) {
      if (values[i]) continue;
      await page.click(`.sdk-cell[data-i="${i}"]`);
      await page.keyboard.press(`Digit${solution[i]}`);
    }
    await waitFor(async () => (await overlayText(page)).includes('Solved'), { message: 'sudoku to be solved' });
  },

  async 'reaction-time'(page) {
    const state = () => page.getAttribute('.rt-panel', 'data-state');
    await page.click('.rt-panel');
    assert((await state()) === 'waiting', 'first click starts waiting');
    await page.click('.rt-panel');
    assert((await state()) === 'early', 'clicking too soon is detected');
    for (let i = 0; i < 5; i += 1) {
      await page.click('.rt-panel');
      await waitFor(async () => (await state()) === 'go', { timeout: 6000, message: 'go signal' });
      await page.click('.rt-panel');
    }
    assert((await state()) === 'done', 'five tries finish the round');
    assert(/\d+ ms/.test(await stat(page, 'Best')), 'best time is recorded');
  },

  async echo(page) {
    // Record which tiles light up during playback.
    await page.evaluate(() => {
      window.__lit = [];
      new MutationObserver((records) => {
        for (const r of records) {
          if (r.target.classList.contains('is-lit') && !(r.oldValue || '').includes('is-lit'))
            window.__lit.push(Number(r.target.dataset.i));
        }
      }).observe(document.querySelector('.echo-grid'), {
        attributes: true,
        attributeFilter: ['class'],
        attributeOldValue: true,
        subtree: true,
      });
    });
    await clickOverlayPrimary(page);
    for (let level = 1; level <= 3; level += 1) {
      await page.evaluate(() => (window.__lit = []));
      await waitFor(() => page.evaluate(() => document.querySelector('.echo-grid').dataset.phase === 'input'), {
        timeout: 8000,
        message: `level ${level} input`,
      });
      const sequence = await page.evaluate(() => window.__lit);
      assert(sequence.length === level, `level ${level} shows ${level} steps (saw ${sequence.length})`);
      for (const tile of sequence) await page.click(`.echo-tile[data-i="${tile}"]`);
    }
    await waitFor(() => page.evaluate(() => document.querySelector('.echo-grid').dataset.phase === 'input'), {
      timeout: 8000,
      message: 'level 4 input',
    });
    const sequence = await page.evaluate(() => window.__lit);
    await page.click(`.echo-tile[data-i="${(sequence[0] + 1) % 9}"]`);
    await waitFor(async () => (await overlayText(page)).includes('Sequence broken'), {
      message: 'game over after a wrong tile',
    });
    assert((await stat(page, 'Best')) === '3', 'best level is recorded');
  },
};

// ------------------------------------------------------------------ run

const server = await startServer();
const browser = await chromium.launch();

try {
  // ---------- Desktop library
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await openPage(desktop);

  await check('library is the first screen', async () => {
    await page.goto(BASE);
    await page.waitForSelector('.game-card');
    assert((await page.textContent('h1')).includes('A little place to play'), 'welcome headline');
    assert((await page.$$('.game-card')).length === games.length, 'all games listed');
    assert((await page.textContent('.count-pill')).includes(`${games.length} games`), 'game count pill');
    assert(!(await page.$('.game-view')), 'no game is open');
  });

  await check('categories filter the grid', async () => {
    for (const id of ['classics', 'arcade', 'brain', 'racing']) {
      await page.click(`[data-category="${id}"]`);
      const expected = games.filter((g) => g.categories.includes(id)).length;
      assert((await page.$$('.game-card')).length === expected, `${id} shows ${expected}`);
      assert((await page.getAttribute(`[data-category="${id}"]`, 'aria-selected')) === 'true', `${id} selected`);
      assert((await page.textContent('.results-header__count')).startsWith(String(expected)), `${id} count`);
    }
    await page.click('[data-category="all"]');
    assert((await page.$$('.game-card')).length === games.length, 'all games again');
  });

  await check('search works together with the category', async () => {
    await page.click('[data-category="classics"]');
    await page.fill('#site-search', 'snake');
    assert(
      (await page.$$eval('.game-card', (c) => c.map((e) => e.dataset.game))).join() === 'snake',
      'snake in classics',
    );
    await page.click('[data-category="arcade"]');
    assert(await page.isVisible('.empty-state'), 'empty state for no matches');
    await page.click('.empty-state .btn:has-text("Clear search")');
    assert((await page.inputValue('#site-search')) === '', 'search cleared');
    assert(
      (await page.$$('.game-card')).length === games.filter((g) => g.categories.includes('arcade')).length,
      'arcade restored',
    );
    await page.click('[data-category="all"]');
  });

  await check('favorites persist across reloads', async () => {
    await page.click('[data-category="favorites"]');
    assert(await page.isVisible('.empty-state'), 'favorites start empty');
    await page.click('[data-category="all"]');
    await page.click('.game-card[data-game="sudoku"] .fav-btn');
    await page.click('.game-card[data-game="pong"] .fav-btn');
    await page.reload();
    await page.waitForSelector('.game-card');
    await page.click('[data-category="favorites"]');
    const favs = await page.$$eval('.game-card', (c) => c.map((e) => e.dataset.game).sort());
    assert(favs.join() === 'pong,sudoku', `favorites were ${favs.join()}`);
    await page.click('.game-card[data-game="pong"] .fav-btn');
    assert((await page.$$('.game-card')).length === 1, 'unfavorite removes the card');
    await page.click('[data-category="all"]');
  });

  await check('a card opens its game and Back returns to the library', async () => {
    await page.click('.game-card[data-game="lane-splitter"] .game-card__link');
    await page.waitForSelector('.game-view[data-game="lane-splitter"] canvas');
    assert(page.url().endsWith('#/play/lane-splitter'), 'hash route');
    assert((await page.textContent('.game-heading__title')) === 'Lane Splitter', 'game title');
    assert(await page.isVisible('text=Back to library'), 'back button');
    await page.click('text=Back to library');
    await page.waitForSelector('.library:not([hidden])');
    assert(!(await page.$('.game-view')), 'game view removed');
    assert(
      await page.evaluate(() => document.activeElement?.closest('[data-game]')?.dataset.game === 'lane-splitter'),
      'focus returns to the card',
    );
  });

  await check('leaving a game stops its animation loop', async () => {
    await page.goto(`${BASE}#/play/lane-splitter`);
    await page.waitForSelector('canvas');
    await clickOverlayPrimary(page);
    await sleep(400);
    await page.click('text=Back to library');
    await sleep(200);
    const before = await page.evaluate(() => window.__frames);
    await sleep(500);
    const after = await page.evaluate(() => window.__frames);
    assert(after - before <= 2, `animation frames kept running (${after - before} in 500 ms)`);
  });

  await check('typing in the search from a game shows results', async () => {
    await page.goto(`${BASE}#/play/snake`);
    await page.waitForSelector('canvas');
    await page.fill('#site-search', 'sudoku');
    await page.waitForSelector('.library:not([hidden])');
    assert(
      (await page.$$eval('.game-card', (c) => c.map((e) => e.dataset.game))).join() === 'sudoku',
      'search results',
    );
    assert(await page.evaluate(() => document.activeElement?.id === 'site-search'), 'search keeps focus');
    await page.fill('#site-search', '');
  });

  if (page.problems.length)
    (results.push(`  FAIL  library had problems:\n        ${page.problems.join('\n        ')}`), (failures += 1));

  // ---------- Every game
  for (const game of games) {
    await check(`game: ${game.title}`, async () => {
      const gamePage = await openPage(desktop);
      try {
        await openGame(gamePage, game.id);
        assert((await gamePage.textContent('.game-heading__title')) === game.title, 'title shown');
        assert((await gamePage.$$('.controls-list li')).length > 0, 'controls listed');
        const script = scripts[game.id];
        assert(script, `no smoke script for ${game.id}`);
        await script(gamePage);
        await gamePage.click('text=Back to library');
        await gamePage.waitForSelector('.library:not([hidden])');
        assert(gamePage.problems.length === 0, gamePage.problems.join('\n'));
      } finally {
        await gamePage.close();
      }
    });
  }
  await desktop.close();

  // ---------- Mobile
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 2,
  });
  await check('mobile: no horizontal overflow on the library or any game', async () => {
    const mpage = await openPage(mobile);
    await mpage.goto(BASE);
    await mpage.waitForSelector('.game-card');
    const overflow = () => mpage.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert((await overflow()) <= 0, `library overflows by ${await overflow()}px`);
    for (const game of games) {
      await openGame(mpage, game.id);
      await sleep(150);
      assert((await overflow()) <= 0, `${game.id} overflows by ${await overflow()}px`);
    }
    assert(mpage.problems.length === 0, mpage.problems.join('\n'));
    await mpage.close();
  });

  await check('mobile: touch controls drive Lane Splitter', async () => {
    const mpage = await openPage(mobile);
    await openGame(mpage, 'lane-splitter');
    assert(await mpage.isVisible('.touch-controls'), 'touch controls visible');
    await mpage.tap('.stage .overlay .btn-primary');
    const throttle = mpage.locator('.touch-btn[aria-label="Throttle"]');
    await throttle.dispatchEvent('pointerdown', { pointerId: 7, pointerType: 'touch', isPrimary: true });
    await sleep(900);
    await throttle.dispatchEvent('pointerup', { pointerId: 7, pointerType: 'touch', isPrimary: true });
    assert(parseFloat(await stat(mpage, 'Distance')) > 0, 'ride progresses on touch');
    assert(mpage.problems.length === 0, mpage.problems.join('\n'));
    await mpage.close();
  });

  await check('mobile: long press flags a mine', async () => {
    const mpage = await openPage(mobile);
    await openGame(mpage, 'minesweeper');
    await mpage.tap('.ms-cell >> nth=40');
    const cell = mpage.locator('.ms-cell:not(.is-open):not(.is-flag)').first();
    await cell.dispatchEvent('pointerdown', {
      pointerId: 3,
      pointerType: 'touch',
      isPrimary: true,
      clientX: 0,
      clientY: 0,
    });
    await sleep(550);
    await cell.dispatchEvent('pointerup', { pointerId: 3, pointerType: 'touch', isPrimary: true });
    assert((await mpage.$$('.ms-cell.is-flag')).length === 1, 'long press placed a flag');
    await mpage.close();
  });

  await check('mobile: swipes move 2048 tiles', async () => {
    const mpage = await openPage(mobile);
    await openGame(mpage, '2048');
    const box = await mpage.$eval('.t48-board', (b) => {
      const r = b.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    const before = await mpage.$$eval('.t48-tile', (els) => els.length);
    for (const [dx, dy] of [
      [-80, 0],
      [0, -80],
      [80, 0],
      [0, 80],
    ]) {
      const id = 11;
      const board = mpage.locator('.t48-board');
      await board.dispatchEvent('pointerdown', {
        pointerId: id,
        pointerType: 'touch',
        clientX: box.x,
        clientY: box.y,
        isPrimary: true,
      });
      await board.dispatchEvent('pointerup', {
        pointerId: id,
        pointerType: 'touch',
        clientX: box.x + dx,
        clientY: box.y + dy,
        isPrimary: true,
      });
      await sleep(160);
    }
    assert((await mpage.$$eval('.t48-tile', (els) => els.length)) > before, 'swipes added tiles');
    await mpage.close();
  });
  await mobile.close();

  // ---------- Reduced motion
  const calm = await browser.newContext({ viewport: { width: 1024, height: 800 }, reducedMotion: 'reduce' });
  await check('reduced motion: games still run', async () => {
    const rpage = await openPage(calm);
    for (const id of ['2048', 'blocks', 'pairs', 'lane-splitter']) {
      await openGame(rpage, id);
      if (id === '2048') {
        await rpage.keyboard.press('ArrowLeft');
        await rpage.keyboard.press('ArrowRight');
      } else if (id === 'pairs') {
        await rpage.click('.pairs-card >> nth=0');
      } else {
        await clickOverlayPrimary(rpage);
        await sleep(600);
      }
    }
    assert(rpage.problems.length === 0, rpage.problems.join('\n'));
    await rpage.close();
  });
  await calm.close();
} finally {
  await browser.close();
  server.kill();
}

console.log(`\nBrowser smoke tests (${BASE})\n`);
console.log(results.join('\n'));
console.log(`\n${results.length - failures} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);

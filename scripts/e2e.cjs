/**
 * End-to-end smoke test against the built app (run `npm run build` first).
 *
 *   npx electron scripts/e2e.cjs <phase> <dataDir> <shotDir>
 *
 * Runs the real main-process bundle with an isolated userData directory and
 * drives the UI through the DOM. Phases are separate processes so restart and
 * recovery are exercised for real. See scripts/e2e.ps1 for the full sequence.
 */
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const [phase, dataDir, shotDir] = process.argv.slice(-3);
app.setPath('userData', path.resolve(dataDir));
fs.mkdirSync(shotDir, { recursive: true });
require('../out/main/index.js');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(`[e2e:${phase}]`, ...a);

function fail(msg) {
  console.error(`[e2e:${phase}] FAIL: ${msg}`);
  app.exit(1);
}

async function main() {
  await app.whenReady();
  let win;
  for (let i = 0; i < 100 && !win; i++) {
    win = BrowserWindow.getAllWindows()[0];
    await sleep(100);
  }
  if (!win) return fail('no window');
  await new Promise((r) => (win.webContents.isLoading() ? win.webContents.once('did-finish-load', r) : r()));
  await sleep(1200);

  const js = (code) => win.webContents.executeJavaScript(code);
  const snapshot = () => js('window.flightMode.getSnapshot()');
  const shot = async (name) => {
    await sleep(500);
    const img = await win.webContents.capturePage();
    fs.writeFileSync(path.join(shotDir, `${phase}-${name}.png`), img.toPNG());
  };
  const text = () => js('document.body.innerText');
  // Matches a button by its visible text, ignoring whitespace (chips render "30" + "мин").
  const click = async (label) => {
    const ok = await js(`(() => {
      const norm = (s) => s.replace(/\\s+/g, '');
      const el = [...document.querySelectorAll('button')].find(b => norm(b.innerText) === norm(${JSON.stringify(label)}));
      if (!el) return false; el.click(); return true; })()`);
    if (!ok) throw new Error(`button not found: ${label}`);
    await sleep(400);
  };
  const type = async (selector, value) => {
    await js(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(el, ${JSON.stringify(value)});
      el.dispatchEvent(new Event('input', { bubbles: true })); })()`);
    await sleep(150);
  };
  const expect = async (needle) => {
    const t = await text();
    // innerText reflects CSS text-transform, so compare case-insensitively.
    if (!t.toLowerCase().includes(needle.toLowerCase())) {
      throw new Error(`expected screen to contain "${needle}"\n---\n${t.slice(0, 600)}`);
    }
  };

  if (phase === 'ui') {
    await expect('Что вы давно');
    await expect('Бортжурнал пока пуст');
    await shot('home-empty');

    // Invalid input is rejected.
    await click('Взлететь');
    await expect('Назовите задачу');

    await type('#task', 'Написать квартальный отчёт');
    await click('30 мин');
    await click('Взлететь');
    await expect('Подготовка к вылету');
    await shot('prepare');

    // Website blocking is on by default; without consent we must be asked first.
    await click('Начать полёт');
    await expect('Разрешить блокировку сайтов?');
    await shot('consent');
    await click('Лететь без блокировки');
    await sleep(800);
    await expect('Вы в полёте');
    let s = await snapshot();
    if (!s.activeFlight || s.activeFlight.plannedDurationMs !== 30 * 60000) throw new Error('flight not started');
    if (s.activeFlight.blocking.sitesActive) throw new Error('sites must not be blocked without consent');
    await expect('Блокировка сайтов выкл.');
    await sleep(2200);
    await shot('in-flight');

    // Countdown is moving.
    s = await snapshot();
    const elapsed = Date.now() - s.activeFlight.startedAt;
    if (elapsed < 2000) throw new Error('clock did not advance');

    await click('Пауза');
    s = await snapshot();
    if (s.activeFlight.pausedAt === null) throw new Error('pause failed');
    await shot('holding');
    await click('Продолжить');
    s = await snapshot();
    if (s.activeFlight.pausedAt !== null || s.activeFlight.pausedTotalMs <= 0) throw new Error('resume failed');

    await click('Аварийная посадка');
    await expect('Запросить аварийную посадку?');
    await shot('emergency-dialog');
    await click('Сесть сейчас');
    await sleep(800);
    await expect('Вы сели раньше');
    await shot('arrival-interrupted');
    s = await snapshot();
    if (s.activeFlight !== null || s.history.length !== 1 || s.history[0].outcome !== 'interrupted') {
      throw new Error('interrupted record missing');
    }

    await click('История рейсов');
    await expect('Бортжурнал');
    await expect('Написать квартальный отчёт');
    await shot('logbook');
    await click('Статистика');
    await shot('insights');
    await click('Настройки');
    await expect('Чёрный список сайтов');
    await shot('settings');

    // Theme switch round-trip.
    await click('Светлая');
    await click('Вылет');
    await shot('home-light');
    await click('Настройки');
    await click('Тёмная');

    // Leave a flight in progress for the recovery phases.
    const r = await js(
      `window.flightMode.startFlight({ taskName: 'Восстановленная задача', durationMin: 1, blockSites: false, blockApps: false })`
    );
    if (!r.ok) throw new Error('could not start recovery flight: ' + r.error);
    log('started flight for recovery test');
  }

  if (phase === 'landed-away') {
    // The data file was edited so this flight ended while the app was closed.
    await expect('Добро пожаловать в пункт назначения.');
    await shot('arrival-completed');
    const s = await snapshot();
    if (s.history.length !== 2 || s.history[0].outcome !== 'completed') throw new Error('completed record missing');
    if (s.history[0].focusedMs !== 60000) throw new Error('focused time wrong: ' + s.history[0].focusedMs);
    const r = await js(
      `window.flightMode.startFlight({ taskName: 'Продолжи меня', durationMin: 1, blockSites: false, blockApps: false })`
    );
    if (!r.ok) throw new Error(r.error);
  }

  if (phase === 'resume') {
    // Flight has ~3s left: it must resume, then land by itself via the main-process timer.
    await expect('Вы в полёте');
    await shot('resumed');
    await sleep(5000);
    await expect('Добро пожаловать в пункт назначения.');
    const s = await snapshot();
    if (s.history.length !== 3 || s.history[0].taskName !== 'Продолжи меня') throw new Error('timer landing missing');
    await click('История рейсов');
    await js(`document.querySelector('[aria-label="Удалить рейс ${s.history[0].flightNumber}"]').click()`);
    await sleep(300);
    await click('Удалить');
    const after = await snapshot();
    if (after.history.length !== 2) throw new Error('delete failed');
    await shot('logbook-after-delete');
  }

  log('PASS');
  app.exit(0);
}

main().catch((err) => fail(err.stack || String(err)));

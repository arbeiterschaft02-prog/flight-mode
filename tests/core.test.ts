import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ActiveFlight, FlightRecord } from '../src/types/index.ts';
import { normalizeDomain, normalizeExeName } from '../src/utils/domains.ts';
import { elapsedMs, flightPhase, progress, remainingMs, untilHalfwayMs, validateDuration, validateTaskName } from '../src/utils/flight.ts';
import { computeStats } from '../src/utils/stats.ts';
import { checklistProgress, sanitizeChecklist } from '../src/utils/checklist.ts';
import { buildHostsContent, hasBlock, stripBlock } from '../electron/main/siteBlocker.ts';
import { parseTasklist } from '../electron/main/appBlocker.ts';
const MIN = 60_000;

function flight(partial: Partial<ActiveFlight> = {}): ActiveFlight {
  return {
    id: 'f1',
    flightNumber: 'FM 100',
    taskName: 'Write report',
    plannedDurationMs: 25 * MIN,
    startedAt: 1_000_000,
    pausedAt: null,
    pausedTotalMs: 0,
    blocking: {
      sitesRequested: false,
      sitesActive: false,
      sitesCount: 0,
      sitesError: null,
      appsRequested: false,
      appsActive: false,
      appsCount: 0
    },
    turbulence: [],
    ...partial
  };
}

describe('flight clock', () => {
  it('derives remaining time from timestamps', () => {
    const f = flight();
    assert.equal(remainingMs(f, f.startedAt), 25 * MIN);
    assert.equal(remainingMs(f, f.startedAt + 10 * MIN), 15 * MIN);
    assert.equal(remainingMs(f, f.startedAt + 99 * MIN), 0);
  });

  it('survives a suspended app: a jump in wall time is reflected immediately', () => {
    const f = flight();
    // No ticks in between — e.g. the laptop slept for 20 minutes.
    assert.equal(remainingMs(f, f.startedAt + 20 * MIN), 5 * MIN);
  });

  it('freezes during a pause and excludes paused time after resuming', () => {
    const paused = flight({ pausedAt: 1_000_000 + 5 * MIN });
    assert.equal(remainingMs(paused, paused.startedAt + 5 * MIN), 20 * MIN);
    assert.equal(remainingMs(paused, paused.startedAt + 50 * MIN), 20 * MIN);
    assert.equal(flightPhase(paused, paused.startedAt + 50 * MIN), 'holding');

    const resumed = flight({ pausedTotalMs: 10 * MIN });
    assert.equal(elapsedMs(resumed, resumed.startedAt + 15 * MIN), 5 * MIN);
  });

  it('reaches the halfway reminder after half the focused time, not counting pauses', () => {
    const forty = flight({ plannedDurationMs: 40 * MIN });
    assert.equal(untilHalfwayMs(forty, forty.startedAt), 20 * MIN);
    assert.equal(untilHalfwayMs(forty, forty.startedAt + 20 * MIN), 0);
    const thirty = flight({ plannedDurationMs: 30 * MIN, pausedTotalMs: 5 * MIN });
    assert.equal(untilHalfwayMs(thirty, thirty.startedAt + 15 * MIN), 5 * MIN);
    assert.equal(untilHalfwayMs(thirty, thirty.startedAt + 20 * MIN), 0);
  });

  it('clamps progress to 0..1', () => {
    const f = flight();
    assert.equal(progress(f, f.startedAt - 5000), 0);
    assert.equal(progress(f, f.startedAt + 100 * MIN), 1);
  });
});

describe('input validation', () => {
  it('rejects empty and overly long task names and collapses whitespace', () => {
    assert.equal(validateTaskName('   ').ok, false);
    assert.equal(validateTaskName('x').ok, false);
    assert.equal(validateTaskName('a'.repeat(81)).ok, false);
    assert.deepEqual(validateTaskName('  Write   the  report '), { ok: true, value: 'Write the report' });
  });

  it('accepts durations between 1 and 240 minutes', () => {
    assert.equal(validateDuration(0).ok, false);
    assert.equal(validateDuration(241).ok, false);
    assert.equal(validateDuration(Number.NaN).ok, false);
    assert.deepEqual(validateDuration(45), { ok: true, value: 45 });
  });
});

describe('domains and apps', () => {
  it('normalises URLs to bare domains', () => {
    assert.equal(normalizeDomain('https://www.YouTube.com/watch?v=1'), 'youtube.com');
    assert.equal(normalizeDomain('reddit.com:443/r/all'), 'reddit.com');
    assert.equal(normalizeDomain('news.ycombinator.com'), 'news.ycombinator.com');
    assert.equal(normalizeDomain('not a domain'), null);
    assert.equal(normalizeDomain('localhost'), null);
  });

  it('normalises executable names', () => {
    assert.equal(normalizeExeName('discord'), 'discord.exe');
    assert.equal(normalizeExeName('C:\\Games\\Steam\\steam.exe'), 'steam.exe');
    assert.equal(normalizeExeName('bad|name'), null);
  });

  it('parses tasklist CSV output', () => {
    const names = parseTasklist('"Discord.exe","1234","Console","1","120,000 K"\r\n"explorer.exe","42","Console","1","9 K"\r\n');
    assert.ok(names.has('discord.exe'));
    assert.ok(names.has('explorer.exe'));
  });
});

describe('hosts file block', () => {
  const original = '# Copyright Microsoft\r\n127.0.0.1 localhost\r\n';

  it('adds a marked block and keeps existing entries', () => {
    const next = buildHostsContent(original, ['youtube.com']);
    assert.ok(hasBlock(next));
    assert.ok(next.includes('127.0.0.1 localhost'));
    assert.ok(next.includes('0.0.0.0 youtube.com'));
    assert.ok(next.includes('0.0.0.0 www.youtube.com'));
  });

  it('is idempotent and fully removable', () => {
    const once = buildHostsContent(original, ['youtube.com']);
    const twice = buildHostsContent(once, ['reddit.com']);
    assert.equal(twice.match(/Flight Mode: focus block/g)?.length, 1);
    assert.ok(!twice.includes('youtube.com'));
    const removed = stripBlock(twice);
    assert.ok(!hasBlock(removed));
    assert.equal(removed, stripBlock(original));
  });
});

describe('checklist', () => {
  it('drops malformed, empty and duplicate items and trims text', () => {
    const items = sanitizeChecklist([
      { id: 'a', text: '  Собрать   цифры ', done: true },
      { id: 'a', text: 'дубликат', done: false },
      { id: 'b', text: '   ', done: false },
      { id: 'c', text: 42 },
      'строка',
      { id: 'd', text: 'x'.repeat(200), done: 'yes' }
    ]);
    assert.deepEqual(items.map((i) => i.id), ['a', 'd']);
    assert.equal(items[0].text, 'Собрать цифры');
    assert.equal(items[1].text.length, 120);
    assert.equal(items[1].done, false);
    assert.deepEqual(sanitizeChecklist('nope'), []);
  });

  it('caps the number of items and reports progress', () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ id: String(i), text: 'пункт ' + i, done: i < 3 }));
    const items = sanitizeChecklist(many);
    assert.equal(items.length, 30);
    assert.deepEqual(checklistProgress(items), { done: 3, total: 30 });
    assert.deepEqual(checklistProgress(undefined), { done: 0, total: 0 });
  });
});

describe('statistics', () => {
  const day = (offset: number, hour = 10) => {
    const d = new Date(2026, 10, 1, hour);
    d.setDate(d.getDate() + offset);
    return d.getTime();
  };
  const rec = (startedAt: number, outcome: FlightRecord['outcome'], focusedMin: number): FlightRecord => ({
    id: `${startedAt}-${outcome}`,
    flightNumber: 'FM 1',
    taskName: 't',
    startedAt,
    endedAt: startedAt + focusedMin * MIN,
    plannedDurationMs: 30 * MIN,
    focusedMs: focusedMin * MIN,
    outcome,
    turbulenceCount: 0,
    sitesBlocked: false,
    appsBlocked: false
  });

  it('handles empty history', () => {
    const s = computeStats([], day(0, 12));
    assert.equal(s.completionRate, null);
    assert.equal(s.streakDays, 0);
    assert.equal(s.lastDays.length, 7);
  });

  it('computes today, totals, completion rate and streak', () => {
    const history = [rec(day(0), 'completed', 30), rec(day(0, 11), 'interrupted', 10), rec(day(-1), 'completed', 45), rec(day(-3), 'completed', 20)];
    const s = computeStats(history, day(0, 18));
    assert.equal(s.today.completed, 1);
    assert.equal(s.today.focusMs, 40 * MIN);
    assert.equal(s.totalFocusMs, 105 * MIN);
    assert.equal(s.completionRate, 0.75);
    assert.equal(s.streakDays, 2);
    assert.equal(s.lastDays.at(-1)?.focusMs, 40 * MIN);
  });

  it('keeps a streak alive until today ends', () => {
    const s = computeStats([rec(day(-1), 'completed', 30)], day(0, 9));
    assert.equal(s.streakDays, 1);
  });
});

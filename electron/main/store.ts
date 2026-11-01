import fs from 'node:fs';
import path from 'node:path';
import type { ActiveFlight, FlightRecord, Settings } from '../../src/types';
import { DEFAULT_BLOCKED_APPS, DEFAULT_BLOCKED_SITES, normalizeDomain, normalizeExeName, uniqueCaseInsensitive } from '../../src/utils/domains';
import { MAX_DURATION_MIN, MIN_DURATION_MIN } from '../../src/types';

const SCHEMA_VERSION = 1;
const MAX_HISTORY = 5000;

export interface PersistedData {
  version: number;
  settings: Settings;
  history: FlightRecord[];
  activeFlight: ActiveFlight | null;
}

export const DEFAULT_SETTINGS: Settings = {
  defaultDurationMin: 45,
  blockedSites: DEFAULT_BLOCKED_SITES,
  blockSitesByDefault: true,
  blockedApps: DEFAULT_BLOCKED_APPS,
  blockAppsByDefault: false,
  hostsConsent: false,
  sound: { enabled: true, volume: 0.6, cabinAmbience: false },
  notifications: { onLanding: true, onTakeoff: false, onTurbulence: true },
  theme: 'dark'
};

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);
const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

/** Coerces anything (old file, hand-edited file, partial patch) into valid settings. */
export function sanitizeSettings(raw: unknown, base: Settings = DEFAULT_SETTINGS): Settings {
  const s = isObj(raw) ? raw : {};
  const sound = isObj(s.sound) ? s.sound : {};
  const notif = isObj(s.notifications) ? s.notifications : {};
  const theme = s.theme === 'dark' || s.theme === 'light' || s.theme === 'system' ? s.theme : base.theme;

  const sites = Array.isArray(s.blockedSites)
    ? uniqueCaseInsensitive(s.blockedSites.map((d) => (typeof d === 'string' ? normalizeDomain(d) : null)).filter((d): d is string => !!d))
    : base.blockedSites;
  const apps = Array.isArray(s.blockedApps)
    ? uniqueCaseInsensitive(s.blockedApps.map((a) => (typeof a === 'string' ? normalizeExeName(a) : null)).filter((a): a is string => !!a))
    : base.blockedApps;

  return {
    defaultDurationMin: Math.min(MAX_DURATION_MIN, Math.max(MIN_DURATION_MIN, Math.round(num(s.defaultDurationMin, base.defaultDurationMin)))),
    blockedSites: sites,
    blockSitesByDefault: bool(s.blockSitesByDefault, base.blockSitesByDefault),
    blockedApps: apps,
    blockAppsByDefault: bool(s.blockAppsByDefault, base.blockAppsByDefault),
    hostsConsent: bool(s.hostsConsent, base.hostsConsent),
    sound: {
      enabled: bool(sound.enabled, base.sound.enabled),
      volume: Math.min(1, Math.max(0, num(sound.volume, base.sound.volume))),
      cabinAmbience: bool(sound.cabinAmbience, base.sound.cabinAmbience)
    },
    notifications: {
      onLanding: bool(notif.onLanding, base.notifications.onLanding),
      onTakeoff: bool(notif.onTakeoff, base.notifications.onTakeoff),
      onTurbulence: bool(notif.onTurbulence, base.notifications.onTurbulence)
    },
    theme
  };
}

function isRecord(v: unknown): v is FlightRecord {
  return (
    isObj(v) &&
    typeof v.id === 'string' &&
    typeof v.taskName === 'string' &&
    typeof v.startedAt === 'number' &&
    typeof v.endedAt === 'number' &&
    typeof v.plannedDurationMs === 'number' &&
    typeof v.focusedMs === 'number' &&
    (v.outcome === 'completed' || v.outcome === 'interrupted')
  );
}

function isActiveFlight(v: unknown): v is ActiveFlight {
  return (
    isObj(v) &&
    typeof v.id === 'string' &&
    typeof v.taskName === 'string' &&
    typeof v.startedAt === 'number' &&
    typeof v.plannedDurationMs === 'number' &&
    typeof v.pausedTotalMs === 'number' &&
    (v.pausedAt === null || typeof v.pausedAt === 'number') &&
    isObj(v.blocking)
  );
}

/**
 * Small JSON document store. Writes go to a temp file first and are then
 * renamed over the real file, so a crash mid-write never corrupts history.
 */
export class DataStore {
  private data: PersistedData;
  readonly filePath: string;

  constructor(dir: string) {
    fs.mkdirSync(dir, { recursive: true });
    this.filePath = path.join(dir, 'flight-mode-data.json');
    this.data = this.load();
  }

  private load(): PersistedData {
    const fresh: PersistedData = { version: SCHEMA_VERSION, settings: DEFAULT_SETTINGS, history: [], activeFlight: null };
    if (!fs.existsSync(this.filePath)) return fresh;
    try {
      // Strip a UTF-8 BOM in case the file was edited with a tool that adds one.
      const text = fs.readFileSync(this.filePath, 'utf8').replace(/^﻿/, '');
      const parsed: unknown = JSON.parse(text);
      if (!isObj(parsed)) throw new Error('Data file is not an object');
      const active = isActiveFlight(parsed.activeFlight) ? parsed.activeFlight : null;
      if (active && !Array.isArray(active.turbulence)) active.turbulence = [];
      return {
        version: SCHEMA_VERSION,
        settings: sanitizeSettings(parsed.settings),
        history: Array.isArray(parsed.history) ? parsed.history.filter(isRecord) : [],
        activeFlight: active
      };
    } catch (err) {
      // Keep the unreadable file for inspection instead of silently losing it.
      const backup = `${this.filePath}.corrupt-${Date.now()}`;
      try {
        fs.renameSync(this.filePath, backup);
      } catch {
        /* ignore */
      }
      console.error('[store] Could not read data file, starting fresh. Backup:', backup, err);
      return fresh;
    }
  }

  get(): Readonly<PersistedData> {
    return this.data;
  }

  update(mutate: (draft: PersistedData) => void): PersistedData {
    const draft: PersistedData = structuredClone(this.data);
    mutate(draft);
    draft.history = draft.history.slice(0, MAX_HISTORY);
    this.persist(draft);
    this.data = draft;
    return draft;
  }

  private persist(data: PersistedData): void {
    const tmp = `${this.filePath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmp, this.filePath);
  }
}

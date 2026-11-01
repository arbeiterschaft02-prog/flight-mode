/**
 * Shared domain types. Imported by both the Electron main process and the
 * React renderer, so this file must stay free of runtime dependencies.
 */

export type ThemePreference = 'system' | 'dark' | 'light';

export type FlightOutcome = 'completed' | 'interrupted';

export interface SoundSettings {
  enabled: boolean;
  /** 0..1 */
  volume: number;
  /** Low cabin-noise ambience while in flight. */
  cabinAmbience: boolean;
}

export interface NotificationSettings {
  onLanding: boolean;
  onTakeoff: boolean;
  /** Notify when a blocked application was closed during a flight. */
  onTurbulence: boolean;
}

export interface Settings {
  defaultDurationMin: number;
  /** Normalised domains, e.g. "youtube.com". */
  blockedSites: string[];
  blockSitesByDefault: boolean;
  /** Executable names, e.g. "Discord.exe". */
  blockedApps: string[];
  blockAppsByDefault: boolean;
  /** User explicitly allowed Flight Mode to edit the Windows hosts file. */
  hostsConsent: boolean;
  sound: SoundSettings;
  notifications: NotificationSettings;
  theme: ThemePreference;
}

export interface BlockingState {
  sitesRequested: boolean;
  /** True only when the hosts file was verified to contain our block. */
  sitesActive: boolean;
  sitesCount: number;
  sitesError: string | null;
  appsRequested: boolean;
  appsActive: boolean;
  appsCount: number;
}

export interface TurbulenceEvent {
  at: number;
  app: string;
}

export interface ActiveFlight {
  id: string;
  flightNumber: string;
  taskName: string;
  plannedDurationMs: number;
  /** Epoch ms when the timer started (after pre-flight blocking setup). */
  startedAt: number;
  /** Epoch ms when the current pause began, null when flying. */
  pausedAt: number | null;
  /** Total ms spent paused in completed pauses. */
  pausedTotalMs: number;
  blocking: BlockingState;
  turbulence: TurbulenceEvent[];
}

export interface FlightRecord {
  id: string;
  flightNumber: string;
  taskName: string;
  startedAt: number;
  endedAt: number;
  plannedDurationMs: number;
  focusedMs: number;
  outcome: FlightOutcome;
  turbulenceCount: number;
  sitesBlocked: boolean;
  appsBlocked: boolean;
}

export interface StartFlightInput {
  taskName: string;
  durationMin: number;
  blockSites: boolean;
  blockApps: boolean;
}

/** What happened to a flight that was in progress when the app last closed. */
export type RecoveryNotice =
  | { kind: 'resumed'; flightId: string }
  | { kind: 'landed-while-away'; record: FlightRecord };

export interface AppSnapshot {
  settings: Settings;
  history: FlightRecord[];
  activeFlight: ActiveFlight | null;
  recovery: RecoveryNotice | null;
  platform: string;
  appVersion: string;
}

export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

export type FlightEvent =
  | { type: 'flight-updated'; flight: ActiveFlight | null }
  | { type: 'flight-landed'; record: FlightRecord; history: FlightRecord[] }
  | { type: 'turbulence'; event: TurbulenceEvent };

/** API exposed to the renderer by the preload script via contextBridge. */
export interface FlightModeApi {
  getSnapshot(): Promise<AppSnapshot>;
  updateSettings(patch: Partial<Settings>): Promise<Result<Settings>>;
  startFlight(input: StartFlightInput): Promise<Result<ActiveFlight>>;
  pauseFlight(): Promise<Result<ActiveFlight>>;
  resumeFlight(): Promise<Result<ActiveFlight>>;
  emergencyLanding(): Promise<Result<FlightRecord>>;
  /** Idempotent: lands the flight if its countdown has elapsed. */
  checkLanding(): Promise<Result<FlightRecord | null>>;
  deleteRecord(id: string): Promise<Result<FlightRecord[]>>;
  clearSiteBlocks(): Promise<Result<null>>;
  getBlockStatus(): Promise<{ hostsBlockPresent: boolean; hostsPath: string }>;  onFlightEvent(listener: (event: FlightEvent) => void): () => void;
}

export const DURATION_PRESETS = [15, 30, 45, 60, 90] as const;
export const MIN_DURATION_MIN = 1;
export const MAX_DURATION_MIN = 240;
export const MAX_TASK_LENGTH = 80;

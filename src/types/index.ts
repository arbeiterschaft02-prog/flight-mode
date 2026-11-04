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
  /** Remind to tick off the checklist halfway through the flight. */
  onHalfway: boolean;
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

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
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
  /** The halfway checklist reminder has been sent (absent on flights from older versions). */
  halfwayReminded?: boolean;
  /** Steps of the task, editable before and during the flight. */
  checklist?: ChecklistItem[];
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
  /** The checklist as it stood at landing (absent on older records). */
  checklist?: ChecklistItem[];
}

export interface StartFlightInput {
  taskName: string;
  durationMin: number;
  blockSites: boolean;
  blockApps: boolean;
  /** Checklist item texts entered on the preparation screen. */
  checklist?: string[];
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
  | { type: 'turbulence'; event: TurbulenceEvent }
  | { type: 'halfway'; flight: ActiveFlight };

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
  /** Replaces the active flight's checklist (items are validated in the main process). */
  updateChecklist(items: ChecklistItem[]): Promise<Result<ActiveFlight>>;
  clearSiteBlocks(): Promise<Result<null>>;
  getBlockStatus(): Promise<{ hostsBlockPresent: boolean; hostsPath: string }>;
  /** Display names of supported browsers that are running. */
  getRunningBrowsers(): Promise<string[]>;
  /** Closes running browsers gracefully and reopens them with their tabs; returns their names. */
  restartBrowsers(): Promise<Result<string[]>>;
  onFlightEvent(listener: (event: FlightEvent) => void): () => void;
}

export const DURATION_PRESETS = [15, 30, 45, 60, 90] as const;
export const MIN_DURATION_MIN = 1;
export const MAX_DURATION_MIN = 240;
export const MAX_TASK_LENGTH = 80;
export const MAX_CHECKLIST_ITEMS = 30;
export const MAX_CHECKLIST_TEXT = 120;

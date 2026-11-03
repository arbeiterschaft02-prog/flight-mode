import { randomUUID } from 'node:crypto';
import type {
  ActiveFlight,
  FlightEvent,
  FlightOutcome,
  FlightRecord,
  RecoveryNotice,
  Result,
  StartFlightInput
} from '../../src/types';
import { elapsedMs, flightNumberFor, remainingMs, untilHalfwayMs, validateDuration, validateTaskName } from '../../src/utils/flight';
import { AppBlocker } from './appBlocker';
import { notify } from './notifier';
import { applySiteBlock, isBlockPresent, removeSiteBlock } from './siteBlocker';
import type { DataStore } from './store';

const ok = <T>(data: T): Result<T> => ({ ok: true, data });
const fail = <T>(error: string): Result<T> => ({ ok: false, error });
const NO_FLIGHT = 'Нет активного рейса.';

/**
 * Owns the flight lifecycle. Lives in the main process so the landing timer,
 * notifications and blocking keep working while the window is hidden, and so
 * system changes never originate from the renderer.
 */
export class FlightService {
  private landingTimer: NodeJS.Timeout | null = null;
  private starting = false;
  private readonly appBlocker: AppBlocker;
  recovery: RecoveryNotice | null = null;

  constructor(
    private readonly store: DataStore,
    private readonly emit: (event: FlightEvent) => void
  ) {
    this.appBlocker = new AppBlocker((app) => this.recordTurbulence(app));
  }

  get active(): ActiveFlight | null {
    return this.store.get().activeFlight;
  }

  /** Called once at startup: resume an in-progress flight or land it if it ended while closed. */
  async recover(): Promise<void> {
    const flight = this.active;
    if (!flight) {
      // No flight in progress: make sure no stale block is left from a crash.
      if (await isBlockPresent()) await removeSiteBlock();
      return;
    }
    if (flight.pausedAt === null && remainingMs(flight, Date.now()) <= 0) {
      const record = await this.land('completed', { notify: false });
      if (record) this.recovery = { kind: 'landed-while-away', record };
      return;
    }
    this.recovery = { kind: 'resumed', flightId: flight.id };
    if (!flight.halfwayReminded && untilHalfwayMs(flight, Date.now()) <= 0) {
      // The halfway point passed while the app was closed; a late reminder would only confuse.
      this.patchActive((f) => {
        f.halfwayReminded = true;
      });
    }
    if (flight.blocking.appsActive) {
      this.appBlocker.start(this.store.get().settings.blockedApps);
    }
    if (flight.blocking.sitesActive && !(await isBlockPresent())) {
      // Someone removed the block while we were closed; re-apply it.
      const result = await applySiteBlock(this.store.get().settings.blockedSites);
      this.patchActive((f) => {
        f.blocking.sitesActive = result.ok;
        f.blocking.sitesError = result.error;
      });
    }
    this.scheduleLanding();
  }

  async start(input: StartFlightInput): Promise<Result<ActiveFlight>> {
    if (this.active) return fail('Рейс уже выполняется.');
    if (this.starting) return fail('Вылет уже готовится.');
    const task = validateTaskName(String(input.taskName ?? ''));
    if (!task.ok) return fail(task.error);
    const duration = validateDuration(Number(input.durationMin));
    if (!duration.ok) return fail(duration.error);

    const { settings } = this.store.get();
    this.starting = true;
    try {
      const sitesRequested = !!input.blockSites && settings.blockedSites.length > 0;
      let sitesActive = false;
      let sitesError: string | null = null;
      if (sitesRequested) {
        if (!settings.hostsConsent) {
          sitesError = 'Нет разрешения на изменение файла hosts.';
        } else {
          const result = await applySiteBlock(settings.blockedSites);
          sitesActive = result.ok;
          sitesError = result.error;
        }
      }

      const appsRequested = !!input.blockApps && settings.blockedApps.length > 0;
      const id = randomUUID();
      const flight: ActiveFlight = {
        id,
        flightNumber: flightNumberFor(id),
        taskName: task.value,
        plannedDurationMs: duration.value * 60_000,
        // The clock starts after blocking setup (which may wait on a UAC prompt).
        startedAt: Date.now(),
        pausedAt: null,
        pausedTotalMs: 0,
        blocking: {
          sitesRequested,
          sitesActive,
          sitesCount: sitesActive ? settings.blockedSites.length : 0,
          sitesError,
          appsRequested,
          appsActive: false,
          appsCount: 0
        },
        turbulence: []
      };
      this.store.update((d) => {
        d.activeFlight = flight;
      });
      if (appsRequested && this.appBlocker.start(settings.blockedApps)) {
        this.patchActive((f) => {
          f.blocking.appsActive = true;
          f.blocking.appsCount = settings.blockedApps.length;
        });
      }
      this.scheduleLanding();
      if (settings.notifications.onTakeoff) {
        notify('Взлёт разрешён', `${flight.flightNumber} · ${task.value} · ${duration.value} мин`);
      }
      const current = this.active!;
      this.emit({ type: 'flight-updated', flight: current });
      return ok(current);
    } finally {
      this.starting = false;
    }
  }

  pause(): Result<ActiveFlight> {
    const flight = this.active;
    if (!flight) return fail(NO_FLIGHT);
    if (flight.pausedAt !== null) return ok(flight);
    const updated = this.patchActive((f) => {
      f.pausedAt = Date.now();
    });
    this.clearLandingTimer();
    this.emit({ type: 'flight-updated', flight: updated });
    return ok(updated);
  }

  resume(): Result<ActiveFlight> {
    const flight = this.active;
    if (!flight) return fail(NO_FLIGHT);
    if (flight.pausedAt === null) return ok(flight);
    const updated = this.patchActive((f) => {
      f.pausedTotalMs += Math.max(0, Date.now() - (f.pausedAt ?? Date.now()));
      f.pausedAt = null;
    });
    this.scheduleLanding();
    this.emit({ type: 'flight-updated', flight: updated });
    return ok(updated);
  }

  async emergencyLanding(): Promise<Result<FlightRecord>> {
    if (!this.active) return fail(NO_FLIGHT);
    const record = await this.land('interrupted', { notify: false });
    return record ? ok(record) : fail(NO_FLIGHT);
  }

  /** Sends the halfway reminder and lands the flight when due. Safe to call repeatedly. */
  async checkLanding(): Promise<Result<FlightRecord | null>> {
    const flight = this.active;
    if (!flight || flight.pausedAt !== null) return ok(null);
    if (remainingMs(flight, Date.now()) > 0) {
      this.checkHalfway(flight);
      this.scheduleLanding();
      return ok(null);
    }
    return ok(await this.land('completed', { notify: true }));
  }

  /** Re-evaluates timers after the system wakes from sleep. */
  onSystemResume(): void {
    void this.checkLanding();
  }

  async clearSiteBlocks(): Promise<Result<null>> {
    const result = await removeSiteBlock();
    if (!result.ok) return fail(result.error ?? 'Не удалось снять блокировку.');
    if (this.active) {
      const updated = this.patchActive((f) => {
        f.blocking.sitesActive = false;
        f.blocking.sitesCount = 0;
      });
      this.emit({ type: 'flight-updated', flight: updated });
    }
    return ok(null);
  }

  dispose(): void {
    this.clearLandingTimer();
    this.appBlocker.stop();
  }

  private landing: Promise<FlightRecord | null> | null = null;

  private land(outcome: FlightOutcome, opts: { notify: boolean }): Promise<FlightRecord | null> {
    // Serialise concurrent landings (timer + renderer check + user action).
    this.landing ??= this.doLand(outcome, opts).finally(() => {
      this.landing = null;
    });
    return this.landing;
  }

  private async doLand(outcome: FlightOutcome, opts: { notify: boolean }): Promise<FlightRecord | null> {
    const flight = this.active;
    if (!flight) return null;
    this.clearLandingTimer();
    this.appBlocker.stop();

    const now = Date.now();
    const record: FlightRecord = {
      id: flight.id,
      flightNumber: flight.flightNumber,
      taskName: flight.taskName,
      startedAt: flight.startedAt,
      endedAt: outcome === 'completed' ? Math.min(now, flight.startedAt + flight.plannedDurationMs + flight.pausedTotalMs) : now,
      plannedDurationMs: flight.plannedDurationMs,
      focusedMs: outcome === 'completed' ? flight.plannedDurationMs : elapsedMs(flight, now),
      outcome,
      turbulenceCount: flight.turbulence.length,
      sitesBlocked: flight.blocking.sitesActive,
      appsBlocked: flight.blocking.appsActive
    };
    const data = this.store.update((d) => {
      d.activeFlight = null;
      d.history = [record, ...d.history.filter((r) => r.id !== record.id)];
    });

    // Lift the block after the record is safely stored. A UAC prompt may appear.
    if (flight.blocking.sitesActive || (await isBlockPresent())) {
      const removed = await removeSiteBlock();
      if (!removed.ok) console.warn('[flight] Could not remove site block:', removed.error);
    }

    if (opts.notify && data.settings.notifications.onLanding) {
      notify(
        outcome === 'completed' ? 'Вы прибыли' : 'Аварийная посадка',
        `${record.flightNumber} · ${record.taskName}`
      );
    }
    this.emit({ type: 'flight-landed', record, history: data.history });
    return record;
  }

  private checkHalfway(flight: ActiveFlight): void {
    if (flight.halfwayReminded || untilHalfwayMs(flight, Date.now()) > 0) return;
    const updated = this.patchActive((f) => {
      f.halfwayReminded = true;
    });
    if (!this.store.get().settings.notifications.onHalfway) return;
    notify('Половина пути', `${flight.taskName} — время отметить чек-лист.`);
    this.emit({ type: 'halfway', flight: updated });
  }

  private recordTurbulence(app: string): void {
    const flight = this.active;
    if (!flight) return;
    const event = { at: Date.now(), app };
    this.patchActive((f) => {
      f.turbulence.push(event);
    });
    this.emit({ type: 'turbulence', event });
    if (this.store.get().settings.notifications.onTurbulence) {
      notify('Турбулентность', `${app} закрыт. Держите курс — вы в полёте.`);
    }
  }

  private patchActive(mutate: (f: ActiveFlight) => void): ActiveFlight {
    const data = this.store.update((d) => {
      if (d.activeFlight) mutate(d.activeFlight);
    });
    return data.activeFlight!;
  }

  private scheduleLanding(): void {
    this.clearLandingTimer();
    const flight = this.active;
    if (!flight || flight.pausedAt !== null) return;
    const now = Date.now();
    const halfway = flight.halfwayReminded ? Infinity : untilHalfwayMs(flight, now);
    const next = Math.min(remainingMs(flight, now), halfway);
    // Cap the delay so long sleeps or clock changes are re-checked regularly.
    this.landingTimer = setTimeout(() => void this.checkLanding(), Math.min(Math.max(next, 0) + 50, 60_000));
  }

  private clearLandingTimer(): void {
    if (this.landingTimer) clearTimeout(this.landingTimer);
    this.landingTimer = null;
  }
}

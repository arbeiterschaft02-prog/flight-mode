import { create } from 'zustand';
import { getApi, unwrap } from '@/services/api';
import { playChime } from '@/services/sound';
import type { ActiveFlight, ChecklistItem, FlightEvent, FlightRecord, Settings } from '@/types';

export type Page = 'home' | 'prepare' | 'flight' | 'arrival' | 'logbook' | 'insights' | 'settings';

export interface Toast {
  id: number;
  message: string;
  tone: 'info' | 'warning' | 'error';
}

export interface FlightDraft {
  taskName: string;
  durationMin: number;
  checklist: ChecklistItem[];
}

interface AppState {
  status: 'loading' | 'ready' | 'error';
  loadError: string | null;
  settings: Settings | null;
  history: FlightRecord[];
  activeFlight: ActiveFlight | null;
  /** The record shown on the arrival screen. */
  arrival: FlightRecord | null;
  page: Page;
  draft: FlightDraft;
  departing: boolean;
  toast: Toast | null;

  init(): Promise<void>;
  navigate(page: Page): void;
  setDraft(patch: Partial<FlightDraft>): void;
  takeOff(opts: { blockSites: boolean; blockApps: boolean }): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  emergencyLanding(): Promise<void>;
  updateChecklist(items: ChecklistItem[]): Promise<void>;
  checkLanding(): Promise<void>;
  deleteRecord(id: string): Promise<void>;
  updateSettings(patch: Partial<Settings>): Promise<Settings | null>;
  showToast(message: string, tone?: Toast['tone']): void;
  dismissToast(): void;
}

let toastSeq = 0;
let initStarted = false;

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : 'Что-то пошло не так.');

export const useAppStore = create<AppState>((set, get) => {
  const chime = (kind: Parameters<typeof playChime>[0]) => {
    const sound = get().settings?.sound;
    if (sound?.enabled) playChime(kind, sound.volume);
  };

  const handleEvent = (event: FlightEvent) => {
    switch (event.type) {
      case 'flight-updated':
        set({ activeFlight: event.flight });
        break;
      case 'flight-landed': {
        const { page } = get();
        // Do not yank the user out of Settings/Logbook mid-edit; the toast tells them.
        const goToArrival = page === 'flight' || page === 'home' || page === 'prepare' || page === 'arrival';
        set({
          activeFlight: null,
          history: event.history,
          arrival: event.record,
          page: goToArrival ? 'arrival' : page
        });
        chime(event.record.outcome === 'completed' ? 'landing' : 'interrupted');
        if (!goToArrival && event.record.outcome === 'completed') {
          get().showToast(`Рейс ${event.record.flightNumber} приземлился. Отличный полёт.`);
        }
        break;
      }
      case 'halfway':
        set({ activeFlight: event.flight });
        get().showToast('Половина пути. Время отметить чек-лист.');
        break;
      case 'turbulence': {
        const flight = get().activeFlight;
        if (flight) set({ activeFlight: { ...flight, turbulence: [...flight.turbulence, event.event] } });
        get().showToast(`Турбулентность: ${event.event.app} закрыт. Держите курс.`, 'warning');
        break;
      }
    }
  };

  return {
    status: 'loading',
    loadError: null,
    settings: null,
    history: [],
    activeFlight: null,
    arrival: null,
    page: 'home',
    draft: { taskName: '', durationMin: 45, checklist: [] },
    departing: false,
    toast: null,

    async init() {
      if (initStarted) return;
      initStarted = true;
      try {
        const api = getApi();
        api.onFlightEvent(handleEvent);
        const snap = await api.getSnapshot();
        let page: Page = snap.activeFlight ? 'flight' : 'home';
        let arrival: FlightRecord | null = null;
        if (snap.recovery?.kind === 'landed-while-away') {
          arrival = snap.recovery.record;
          page = 'arrival';
        }
        set({
          status: 'ready',
          settings: snap.settings,
          history: snap.history,
          activeFlight: snap.activeFlight,
          arrival,
          page,
          draft: { taskName: '', durationMin: snap.settings.defaultDurationMin, checklist: [] }
        });
        if (snap.recovery?.kind === 'resumed') {
          get().showToast('Рейс восстановлен после перезапуска. Отсчёт не прерывался.');
        }
      } catch (err) {
        set({ status: 'error', loadError: errorMessage(err) });
      }
    },

    navigate(page) {
      const { activeFlight } = get();
      // While airborne, "home" and "prepare" mean the flight deck.
      if (activeFlight && (page === 'home' || page === 'prepare')) page = 'flight';
      if (!activeFlight && page === 'flight') page = 'home';
      set({ page });
    },

    setDraft(patch) {
      set({ draft: { ...get().draft, ...patch } });
    },

    async takeOff({ blockSites, blockApps }) {
      if (get().departing) return;
      const { draft } = get();
      set({ departing: true });
      try {
        const flight = unwrap(
          await getApi().startFlight({
            taskName: draft.taskName,
            durationMin: draft.durationMin,
            blockSites,
            blockApps,
            checklist: draft.checklist.map((i) => i.text)
          })
        );
        set({ activeFlight: flight, page: 'flight', draft: { ...draft, taskName: '', checklist: [] } });
        chime('takeoff');
        const b = flight.blocking;
        if (b.sitesRequested && !b.sitesActive) {
          get().showToast(`Сайты не заблокированы: ${b.sitesError ?? 'неизвестная ошибка'}`, 'warning');
        }
      } catch (err) {
        get().showToast(errorMessage(err), 'error');
      } finally {
        set({ departing: false });
      }
    },

    async pause() {
      try {
        set({ activeFlight: unwrap(await getApi().pauseFlight()) });
      } catch (err) {
        get().showToast(errorMessage(err), 'error');
      }
    },

    async resume() {
      try {
        set({ activeFlight: unwrap(await getApi().resumeFlight()) });
      } catch (err) {
        get().showToast(errorMessage(err), 'error');
      }
    },

    async emergencyLanding() {
      try {
        // The resulting 'flight-landed' event updates state and navigates.
        unwrap(await getApi().emergencyLanding());
      } catch (err) {
        get().showToast(errorMessage(err), 'error');
      }
    },

    async updateChecklist(items) {
      const flight = get().activeFlight;
      if (!flight) return;
      // Optimistic: ticking a box must feel instant; the main process echoes the stored list.
      set({ activeFlight: { ...flight, checklist: items } });
      try {
        set({ activeFlight: unwrap(await getApi().updateChecklist(items)) });
      } catch (err) {
        get().showToast(errorMessage(err), 'error');
      }
    },

    async checkLanding() {
      try {
        unwrap(await getApi().checkLanding());
      } catch (err) {
        console.warn('[store] Landing check failed:', err);
      }
    },

    async deleteRecord(id) {
      try {
        set({ history: unwrap(await getApi().deleteRecord(id)) });
      } catch (err) {
        get().showToast(errorMessage(err), 'error');
      }
    },

    async updateSettings(patch) {
      try {
        const settings = unwrap(await getApi().updateSettings(patch));
        set({ settings });
        return settings;
      } catch (err) {
        get().showToast(errorMessage(err), 'error');
        return null;
      }
    },

    showToast(message, tone = 'info') {
      set({ toast: { id: ++toastSeq, message, tone } });
    },

    dismissToast() {
      set({ toast: null });
    }
  };
});

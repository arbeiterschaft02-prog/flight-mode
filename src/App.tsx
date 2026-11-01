import { useEffect } from 'react';
import { Button } from './components/Button';
import { LogoMark } from './components/Logo';
import { ToastHost } from './components/Toast';
import { useCabinAmbience } from './hooks/useCabinAmbience';
import { AppLayout } from './layouts/AppLayout';
import { ArrivalPage } from './pages/ArrivalPage';
import { HomePage } from './pages/HomePage';
import { InFlightPage } from './pages/InFlightPage';
import { InsightsPage } from './pages/InsightsPage';
import { LogbookPage } from './pages/LogbookPage';
import { PreparationPage } from './pages/PreparationPage';
import { SettingsPage } from './pages/SettingsPage';
import { useAppStore } from './store/useAppStore';

function CurrentPage() {
  const page = useAppStore((s) => s.page);
  switch (page) {
    case 'home':
      return <HomePage />;
    case 'prepare':
      return <PreparationPage />;
    case 'flight':
      return <InFlightPage />;
    case 'arrival':
      return <ArrivalPage />;
    case 'logbook':
      return <LogbookPage />;
    case 'insights':
      return <InsightsPage />;
    case 'settings':
      return <SettingsPage />;
  }
}

export function App() {
  const status = useAppStore((s) => s.status);
  const loadError = useAppStore((s) => s.loadError);
  const init = useAppStore((s) => s.init);
  const flying = useAppStore((s) => s.activeFlight !== null && s.activeFlight.pausedAt === null);
  const sound = useAppStore((s) => s.settings?.sound);

  useEffect(() => {
    void init();
  }, [init]);

  // Ambience follows the flight, not the page, so browsing the logbook mid-flight keeps it.
  useCabinAmbience(flying, sound);

  if (status === 'loading') {
    return (
      <div className="drag flex h-full items-center justify-center">
        <LogoMark size={36} />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="drag flex h-full items-center justify-center p-10">
        <div className="no-drag max-w-md text-center">
          <p className="label">Ошибка запуска</p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">Flight Mode не смог загрузить данные.</h1>
          <p className="mt-3 text-sm text-muted">{loadError}</p>
          <Button variant="primary" className="mt-6" onClick={() => window.location.reload()}>
            Попробовать снова
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <AppLayout>
        <CurrentPage />
      </AppLayout>
      <ToastHost />
    </>
  );
}

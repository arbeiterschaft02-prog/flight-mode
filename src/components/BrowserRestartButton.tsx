import { RotateCw } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/Button';
import { Dialog } from '@/components/Dialog';
import { getApi } from '@/services/api';
import { useAppStore } from '@/store/useAppStore';

/** Restarts the running browsers (after confirmation) so they see the hosts block. */
export function BrowserRestartButton({ browsers, onDone }: { browsers: string[]; onDone?(): void }) {
  const showToast = useAppStore((s) => s.showToast);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const names = browsers.join(', ');

  const restart = async () => {
    setBusy(true);
    try {
      const result = await getApi().restartBrowsers();
      if (result.ok) {
        showToast(
          result.data.length ? `Перезапущено: ${result.data.join(', ')}. Вкладки восстановлены.` : 'Открытых браузеров не найдено.'
        );
      } else {
        showToast(`Не удалось перезапустить браузер: ${result.error}`, 'error');
      }
    } finally {
      setBusy(false);
      setConfirmOpen(false);
      onDone?.();
    }
  };

  return (
    <>
      <Button size="sm" icon={<RotateCw size={14} />} loading={busy} onClick={() => setConfirmOpen(true)}>
        Перезапустить браузер
      </Button>
      <Dialog
        open={confirmOpen}
        onClose={() => !busy && setConfirmOpen(false)}
        title="Перезапустить браузер?"
        icon={
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
            <RotateCw size={20} />
          </div>
        }
        actions={
          <>
            <Button variant="ghost" disabled={busy} onClick={() => setConfirmOpen(false)}>
              Отмена
            </Button>
            <Button variant="primary" data-autofocus loading={busy} onClick={() => void restart()}>
              Перезапустить
            </Button>
          </>
        }
      >
        <p>
          {names ? <span className="font-medium text-ink">{names}</span> : 'Браузер'} закроется и сразу откроется снова со
          всеми окнами и вкладками — как после перезагрузки Windows.
        </p>
        <p className="mt-3">Текст, введённый в формы на страницах и не отправленный, может пропасть.</p>
      </Dialog>
    </>
  );
}

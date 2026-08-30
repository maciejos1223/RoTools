import { useState } from 'react';
import { useAppState } from './api.js';
import { useI18n } from './i18n.jsx';
import ModelViewer from './components/ModelViewer.jsx';
import AssetList from './components/AssetList.jsx';
import SfxPanel from './components/SfxPanel.jsx';
import ActivityLog from './components/ActivityLog.jsx';
import Toasts from './components/Toasts.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import { Settings, Languages } from 'lucide-react';

function StatusItem({ label, ok, detail, pulse }) {
  return (
    <div className="flex items-center gap-1.5" title={detail}>
      <span className={`dot ${ok ? 'dot-ok' : 'dot-off'} ${pulse && ok ? 'dot-live' : ''}`} />
      <span className={ok ? 'text-[12px] text-[var(--text-2)]' : 'text-[12px] text-[var(--text-3)]'}>
        {label}
      </span>
    </div>
  );
}

function LanguageToggle() {
  const { lang, setLang } = useI18n();
  return (
    <button
      className="btn btn-icon btn-ghost !text-[10px] font-semibold mono"
      title="Switch language / Zmień język"
      onClick={() => setLang(lang === 'en' ? 'pl' : 'en')}
    >
      {lang.toUpperCase()}
    </button>
  );
}

export default function App() {
  const { state, connected } = useAppState();
  const { t } = useI18n();
  const [showSettings, setShowSettings] = useState(false);

  const robloxOnline = state?.roblox?.online;

  return (
    <div className="flex h-full flex-col">
      {/* header */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--line)] px-4">
        <div className="flex items-center gap-2.5">
          <span className="h-2 w-2 rounded-full bg-[var(--primary)]" />
          <span className="text-[13.5px] font-semibold tracking-tight">RoTools</span>
          <span className="text-[11px] text-[var(--text-3)]">{t('app.subtitle')}</span>
        </div>
        <div className="flex items-center gap-4">
          <StatusItem label={t('status.live')} ok={connected} detail={connected ? t('status.liveOk') : t('status.liveErr')} pulse />
          <StatusItem label={t('status.api')} ok={!!state} detail={state ? t('status.apiOk') : t('status.apiErr')} />
          <StatusItem label={t('status.roblox')} ok={!!robloxOnline} detail={robloxOnline ? t('status.robloxOk') : t('status.robloxErr')} pulse />
          <div className="mx-1 h-4 w-px bg-[var(--line)]" />
          <button className="btn btn-icon btn-ghost" title={t('settings.title')} onClick={() => setShowSettings(true)}>
            <Settings size={14} />
          </button>
          <LanguageToggle />
        </div>
      </header>

      {/* main */}
      <main className="grid min-h-0 flex-1 grid-cols-1 gap-3 p-3 lg:grid-cols-[1fr_340px]">
        {/* left column */}
        <div className="flex min-h-0 flex-col gap-3">
          <div className="min-h-0 flex-1">
            <ModelViewer pendingModel={state?.pendingModel || null} />
          </div>
          <div className="h-[200px] shrink-0">
            <ActivityLog activity={state?.activity || []} onClear={() => {}} />
          </div>
        </div>

        {/* right column */}
        <div className="flex min-h-0 flex-col gap-3">
          <div className="min-h-[180px] flex-[1.2]">
            <AssetList assets={state?.assets || []} />
          </div>
          <div className="min-h-[240px] flex-1">
            <SfxPanel sfxList={state?.sfx || []} />
          </div>
        </div>
      </main>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      <Toasts />
    </div>
  );
}

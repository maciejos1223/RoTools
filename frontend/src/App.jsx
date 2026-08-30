import { useAppState } from './api.js';
import { useI18n } from './i18n.jsx';
import ModelViewer from './components/ModelViewer.jsx';
import AssetList from './components/AssetList.jsx';
import SfxPanel from './components/SfxPanel.jsx';
import ActivityLog from './components/ActivityLog.jsx';
import Toasts from './components/Toasts.jsx';
import { Blocks, Wifi, WifiOff, MonitorPlay, MonitorX, Radio, RadioTower, Languages } from 'lucide-react';

function StatusPill({ icon: Icon, label, ok, detail, pulse }) {
  return (
    <div
      title={detail}
      className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-medium transition ${
        ok
          ? 'border-emerald-400/25 bg-emerald-400/[0.08] text-emerald-200'
          : 'border-white/10 bg-white/[0.03] text-white/40'
      }`}
    >
      <span className={`h-[7px] w-[7px] rounded-full ${ok ? (pulse ? 'dot-live bg-emerald-400' : 'bg-emerald-400') : 'bg-white/20'}`} />
      <Icon size={13} />
      {label}
    </div>
  );
}

function LanguageToggle() {
  const { lang, setLang } = useI18n();
  return (
    <button
      className="btn !px-2.5 !py-1.5 !text-[11px] font-semibold"
      title="Switch language / Zmień język"
      onClick={() => setLang(lang === 'en' ? 'pl' : 'en')}
    >
      <Languages size={13} />
      {lang.toUpperCase()}
    </button>
  );
}

export default function App() {
  const { state, connected } = useAppState();
  const { t } = useI18n();

  const robloxOnline = state?.roblox?.online;

  return (
    <div className="relative z-10 flex h-full flex-col">
      {/* header */}
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-white/[0.06] px-5 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="glow-accent flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-cyan-400 text-white">
            <Blocks size={18} />
          </div>
          <div>
            <div className="text-[15px] font-bold leading-tight">
              Ro<span className="text-gradient">Tools</span>
            </div>
            <div className="text-[10px] font-medium tracking-wide text-white/35">{t('app.subtitle')}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <StatusPill
            icon={connected ? Radio : RadioTower}
            label={t('status.live')}
            ok={connected}
            detail={connected ? t('status.liveOk') : t('status.liveErr')}
            pulse
          />
          <StatusPill
            icon={connected ? Wifi : WifiOff}
            label={t('status.api')}
            ok={!!state}
            detail={state ? t('status.apiOk') : t('status.apiErr')}
          />
          <StatusPill
            icon={robloxOnline ? MonitorPlay : MonitorX}
            label={t('status.roblox')}
            ok={!!robloxOnline}
            detail={robloxOnline ? t('status.robloxOk') : t('status.robloxErr')}
            pulse
          />
        </div>
      </header>

      {/* main */}
      <main className="grid min-h-0 flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-[1fr_360px]">
        {/* left column */}
        <div className="flex min-h-0 flex-col gap-4">
          <div className="min-h-[46%] flex-1">
            <ModelViewer pendingModel={state?.pendingModel || null} />
          </div>
          <div className="h-[220px] shrink-0">
            <ActivityLog activity={state?.activity || []} onClear={() => {}} />
          </div>
        </div>

        {/* right column */}
        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto pr-0.5 lg:max-h-full">
          <div className="min-h-[190px] flex-[1.2]">
            <AssetList assets={state?.assets || []} />
          </div>
          <div className="min-h-[260px] flex-1">
            <SfxPanel sfxList={state?.sfx || []} />
          </div>
        </div>
      </main>

      <Toasts />
    </div>
  );
}

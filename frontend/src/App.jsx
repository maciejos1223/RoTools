import { useState } from 'react';
import { useAppState } from './api.js';
import { useI18n } from './i18n.jsx';
import ModelViewer from './components/ModelViewer.jsx';
import AssetList from './components/AssetList.jsx';
import SfxPanel from './components/SfxPanel.jsx';
import ActivityLog from './components/ActivityLog.jsx';
import Toasts from './components/Toasts.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import {
  Box, Volume2, Package, ScrollText, Settings, Languages,
} from 'lucide-react';

const PAGES = [
  { id: 'models', icon: Box, labelKey: 'nav.models', titleKey: 'nav.models' },
  { id: 'audio', icon: Volume2, labelKey: 'nav.audio', titleKey: 'nav.audio' },
  { id: 'assets', icon: Package, labelKey: 'nav.assets', titleKey: 'nav.assets' },
  { id: 'activity', icon: ScrollText, labelKey: 'nav.activity', titleKey: 'nav.activity' },
];

function StatusItem({ label, ok, title, pulse }) {
  return (
    <div className="flex items-center gap-2" title={title}>
      <span className={`dot ${ok ? 'dot-ok' : 'dot-off'} ${pulse && ok ? 'dot-live' : ''}`} />
      <span className={`text-[12px] font-medium ${ok ? 'text-[var(--text-2)]' : 'text-[var(--text-3)]'}`}>{label}</span>
    </div>
  );
}

export default function App() {
  const { state, connected } = useAppState();
  const { t, lang, setLang } = useI18n();
  const [page, setPage] = useState('models');
  const [showSettings, setShowSettings] = useState(false);

  const pending = state?.pendingModel;
  const assets = state?.assets || [];
  const sfxList = state?.sfx || [];
  const activity = state?.activity || [];

  const hasPending = pending?.status === 'pending';
  const activePage = PAGES.find((p) => p.id === page);

  return (
    <div className="flex h-full">
      {/* ---------- sidebar ---------- */}
      <aside className="flex w-[200px] shrink-0 flex-col border-r border-[var(--line)]">
        {/* branding */}
        <div className="flex h-[52px] items-center gap-2.5 border-b border-[var(--line)] px-4">
          <span className="h-2 w-2 rounded-full bg-[var(--lime)]" />
          <span className="text-[13.5px] font-semibold tracking-tight">RoTools</span>
        </div>

        {/* nav */}
        <nav className="flex flex-1 flex-col gap-0.5 p-2.5">
          <div className="nav-section section-label">{t('nav.workspace')}</div>
          {PAGES.map((p) => {
            const badge =
              p.id === 'models' && hasPending ? t('nav.pending') : p.id === 'audio' && sfxList.length ? sfxList.length : p.id === 'assets' && assets.length ? assets.length : null;
            return (
              <button key={p.id} className={`nav-item ${page === p.id ? 'on' : ''}`} onClick={() => setPage(p.id)}>
                <p.icon size={16} strokeWidth={1.8} />
                <span className="flex-1">{t(p.labelKey)}</span>
                {badge && (
                  <span className="mono tnum rounded-md bg-[var(--surface-3)] px-1.5 py-0.5 text-[10px] leading-4 text-[var(--text-2)]">
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* bottom actions */}
        <div className="flex items-center gap-1.5 border-t border-[var(--line)] p-2.5">
          <button className="btn btn-ghost btn-sm flex-1" title={t('settings.title')} onClick={() => setShowSettings(true)}>
            <Settings size={14} />
            {t('settings.title')}
          </button>
          <button
            className="btn btn-ghost btn-pill mono !px-3 !py-[5px] !text-[10.5px]"
            title="Switch language / Zmień język"
            onClick={() => setLang(lang === 'en' ? 'pl' : 'en')}
          >
            {lang.toUpperCase()}
          </button>
        </div>
      </aside>

      {/* ---------- top bar + content ---------- */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* compact top bar */}
        <header className="flex h-[48px] shrink-0 items-center justify-between border-b border-[var(--line)] px-6">
          <div className="text-[13px] font-semibold tracking-tight text-[var(--text-2)]">
            {t(activePage.titleKey)}
            {page === 'models' && hasPending && (
              <span className="badge badge-lime ml-2.5 !py-[2px] align-middle">{t('nav.pendingBadge')}</span>
            )}
          </div>
          <div className="flex items-center gap-5">
            <StatusItem label="API" ok={!!state} title={state ? t('status.apiOk') : t('status.apiErr')} />
            <StatusItem label="Live" ok={connected} title={connected ? t('status.liveOk') : t('status.liveErr')} pulse />
            <StatusItem label={t('status.roblox')} ok={!!state?.roblox?.online} title={state?.roblox?.online ? t('status.robloxOk') : t('status.robloxErr')} pulse />
          </div>
        </header>

        {/* main */}
        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto h-full max-w-[1080px] px-8 py-7">
            {page === 'models' && (
              <div className="flex h-full min-h-0 flex-col">
                <ModelViewer pendingModel={pending || null} />
                <div className="mt-5 h-[230px] shrink-0">
                  <ActivityLog activity={activity} onClear={() => {}} />
                </div>
              </div>
            )}
            {page === 'audio' && <SfxPage sfxList={sfxList} />}
            {page === 'assets' && <AssetsPage assets={assets} />}
            {page === 'activity' && <ActivityPage activity={activity} />}
          </div>
        </main>
      </div>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      <Toasts />
    </div>
  );
}

function PageHeader({ title, desc, accentWord, children }) {
  return (
    <div className="mb-7">
      <h1 className="text-[24px] font-bold tracking-tight">
        {title} {accentWord && <span className="serif-accent text-[var(--text-2)]">{accentWord}</span>}
      </h1>
      {desc && <p className="serif-accent mt-1 text-[15px] text-[var(--text-3)]">{desc}</p>}
    </div>
  );
}

function SfxPage({ sfxList }) {
  const { t } = useI18n();
  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title={t('nav.audio')} accentWord="studio" desc={t('audio.pageDesc')} />
      <div className="min-h-0 flex-1">
        <SfxPanel sfxList={sfxList} />
      </div>
    </div>
  );
}

function AssetsPage({ assets }) {
  const { t } = useI18n();
  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title={t('nav.assets')} accentWord="collection" desc={t('assets.pageDesc')} />
      <div className="min-h-0 flex-1">
        <AssetList assets={assets} />
      </div>
    </div>
  );
}

function ActivityPage({ activity }) {
  const { t } = useI18n();
  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title={t('nav.activity')} accentWord="feed" desc={t('log.pageDesc')} />
      <div className="min-h-0 flex-1">
        <ActivityLog activity={activity} onClear={() => {}} full />
      </div>
    </div>
  );
}

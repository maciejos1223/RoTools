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
  { id: 'models', icon: Box, labelKey: 'nav.models' },
  { id: 'audio', icon: Volume2, labelKey: 'nav.audio' },
  { id: 'assets', icon: Package, labelKey: 'nav.assets' },
  { id: 'activity', icon: ScrollText, labelKey: 'nav.activity' },
];

function NavItem({ icon: Icon, label, active, onClick, badge }) {
  return (
    <button className={`nav-item ${active ? 'on' : ''}`} onClick={onClick}>
      <Icon size={16} className="shrink-0" style={active ? { color: 'var(--primary)' } : undefined} />
      <span className="flex-1">{label}</span>
      {badge > 0 && (
        <span className="mono rounded-md bg-[var(--bg)] px-1.5 py-0.5 text-[10.5px] text-[var(--text-2)]">
          {badge}
        </span>
      )}
    </button>
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

  const badges = { models: 0, audio: sfxList.length, assets: assets.length, activity: 0 };

  return (
    <div className="flex h-full">
      {/* ---------- sidebar ---------- */}
      <aside className="flex w-[220px] shrink-0 flex-col border-r border-[var(--line)] bg-[var(--surface)]">
        <div className="flex h-[60px] items-center gap-2.5 border-b border-[var(--line)] px-4">
          <span className="h-2.5 w-2.5 rounded-md bg-[var(--primary)]" />
          <div className="leading-tight">
            <div className="text-[14.5px] font-semibold tracking-tight">RoTools</div>
            <div className="text-[10.5px] text-[var(--text-3)]">{t('app.subtitle')}</div>
          </div>
        </div>

        <nav className="flex flex-col gap-1 p-3">
          {PAGES.map((p) => (
            <NavItem
              key={p.id}
              icon={p.icon}
              label={t(p.labelKey)}
              active={page === p.id}
              onClick={() => setPage(p.id)}
              badge={badges[p.id]}
            />
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-1 border-t border-[var(--line)] p-3">
          <button className="nav-item" onClick={() => setShowSettings(true)}>
            <Settings size={16} className="shrink-0" />
            <span className="flex-1">{t('settings.title')}</span>
          </button>
          <button className="nav-item" onClick={() => setLang(lang === 'en' ? 'pl' : 'en')}>
            <Languages size={16} className="shrink-0" />
            <span className="flex-1">{lang === 'en' ? 'Polski' : 'English'}</span>
          </button>
          <div className="mt-2 flex items-center justify-between px-3 py-1.5 text-[11px]">
            <StatusDot label="API" ok={!!state} title={state ? t('status.apiOk') : t('status.apiErr')} />
            <StatusDot label={t('status.live')} ok={connected} title={connected ? t('status.liveOk') : t('status.liveErr')} pulse />
            <StatusDot label={t('status.roblox')} ok={!!state?.roblox?.online} title={state?.roblox?.online ? t('status.robloxOk') : t('status.robloxErr')} pulse />
          </div>
        </div>
      </aside>

      {/* ---------- content ---------- */}
      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto h-full p-4" style={{ maxWidth: 1400 }}>
          {page === 'models' && (
            <div className="flex h-full min-h-0 flex-col gap-4">
              <ModelViewer pendingModel={pending || null} />
              <div className="h-[240px] shrink-0">
                <ActivityLog activity={activity} onClear={() => {}} />
              </div>
            </div>
          )}
          {page === 'audio' && <SfxPage sfxList={sfxList} />}
          {page === 'assets' && <AssetsPage assets={assets} />}
          {page === 'activity' && <ActivityPage activity={activity} />}
        </div>
      </main>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      <Toasts />
    </div>
  );
}

function StatusDot({ label, ok, title, pulse }) {
  return (
    <div className="flex items-center gap-1.5" title={title}>
      <span className={`dot !h-[7px] !w-[7px] ${ok ? 'dot-ok' : 'dot-off'} ${pulse && ok ? 'dot-live' : ''}`} />
      <span className={ok ? 'text-[var(--text-2)]' : 'text-[var(--text-3)]'}>{label}</span>
    </div>
  );
}

function PageHeader({ title, desc, children }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <h1 className="text-[17px] font-semibold tracking-tight">{title}</h1>
        {desc && <p className="mt-0.5 text-[12.5px] text-[var(--text-3)]">{desc}</p>}
      </div>
      {children}
    </div>
  );
}

function SfxPage({ sfxList }) {
  const { t } = useI18n();
  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title={t('nav.audio')} desc={t('audio.pageDesc')} />
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
      <PageHeader title={t('nav.assets')} desc={t('assets.pageDesc')} />
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
      <PageHeader title={t('nav.activity')} desc={t('log.pageDesc')} />
      <div className="min-h-0 flex-1">
        <ActivityLog activity={activity} onClear={() => {}} full />
      </div>
    </div>
  );
}

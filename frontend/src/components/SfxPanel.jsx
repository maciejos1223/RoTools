import { useRef, useState } from 'react';
import { Play, Pause, Download, Loader2, Sparkles, Music4, Mic, Zap } from 'lucide-react';
import { api } from '../api.js';
import { useI18n } from '../i18n.jsx';
import { toast, showToastError } from '../toast.js';

const KIND_META = [
  { id: 'sfx', icon: Zap },
  { id: 'voice', icon: Mic },
  { id: 'music', icon: Music4 },
];

function SfxRow({ sfx }) {
  const { t } = useI18n();
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) {
      el.play();
      setPlaying(true);
    } else {
      el.pause();
      setPlaying(false);
    }
  };

  return (
    <li className="fade-up flex items-center gap-2.5 rounded-lg border border-transparent p-2 transition hover:border-[var(--line)] hover:bg-[var(--surface-2)]">
      <audio ref={audioRef} src={sfx.url} onEnded={() => setPlaying(false)} onPause={() => setPlaying(false)} />
      <button
        onClick={toggle}
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition ${
          playing
            ? 'border-[rgba(110,121,244,0.5)] bg-[rgba(110,121,244,0.15)] text-[var(--primary)]'
            : 'border-[var(--line)] text-[var(--text-2)] hover:border-[var(--line-strong)]'
        }`}
      >
        {playing ? <Pause size={13} /> : <Play size={13} className="ml-0.5" />}
      </button>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12.5px] font-medium text-[var(--text)]">{sfx.prompt}</div>
        <div className="mono truncate text-[10px] text-[var(--text-3)]">
          {sfx.name} · {(sfx.bytes / 1024).toFixed(0)} KB · {sfx.provider}
        </div>
        {sfx.lyrics && (
          <div className="mono mt-1 max-h-14 overflow-y-auto whitespace-pre-wrap rounded-md border border-[var(--line)] bg-[var(--bg)] p-1.5 text-[9.5px] leading-relaxed text-[var(--text-3)]">
            {sfx.lyrics}
          </div>
        )}
      </div>
      <a href={sfx.url} download={sfx.name} className="btn btn-icon btn-ghost" title="Download">
        <Download size={13} />
      </a>
    </li>
  );
}

export default function SfxPanel({ sfxList }) {
  const { t } = useI18n();
  const [kind, setKind] = useState('sfx');
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);

  const generate = async (e) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    setGenerating(true);
    toast(t('sfx.toastGenerating'), 'info');
    try {
      await api('/api/sfx', { method: 'POST', body: { prompt: prompt.trim(), kind } });
      toast(t('sfx.toastReady'), 'success');
      setPrompt('');
    } catch (err) {
      showToastError(err);
    } finally {
      setGenerating(false);
    }
  };

  const placeholder =
    kind === 'music' ? t('sfx.placeholderMusic') : kind === 'voice' ? t('sfx.placeholderVoice') : t('sfx.placeholderSfx');

  return (
    <div className="panel flex min-h-0 flex-col">
      <div className="panel-header">
        <div className="panel-title">{t('sfx.title')}</div>
        <div className="segmented">
          {KIND_META.map(({ id, icon: Icon }) => (
            <button key={id} className={kind === id ? 'on' : ''} onClick={() => setKind(id)}>
              <Icon size={11} />
              {t(`sfx.kind${id[0].toUpperCase()}${id.slice(1)}`)}
            </button>
          ))}
        </div>
      </div>
      <form onSubmit={generate} className="flex gap-2 border-b border-[var(--line)] p-2.5">
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={placeholder}
          className="input flex-1 !text-[12px]"
        />
        <button className="btn btn-primary btn-sm" disabled={generating || !prompt.trim()}>
          {generating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
          {t('sfx.generate')}
        </button>
      </form>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {sfxList.length === 0 ? (
          <p className="px-3 py-6 text-center text-[12px] text-[var(--text-3)]">{t('sfx.empty')}</p>
        ) : (
          <ul className="space-y-1">
            {sfxList.map((s) => (
              <SfxRow key={s.id} sfx={s} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

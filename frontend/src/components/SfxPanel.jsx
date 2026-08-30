import { useRef, useState } from 'react';
import { Play, Pause, Download, AudioWaveform, Loader2, Sparkles, Music4, Mic, Zap } from 'lucide-react';
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

  const KindIcon = sfx.kind === 'music' ? Music4 : sfx.kind === 'voice' ? Mic : Zap;

  return (
    <li className="fade-up flex items-center gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] p-2.5 transition hover:border-white/[0.1] hover:bg-white/[0.045]">
      <audio
        ref={audioRef}
        src={sfx.url}
        onEnded={() => setPlaying(false)}
        onPause={() => setPlaying(false)}
      />
      <button
        onClick={toggle}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition ${
          playing
            ? 'border-cyan-300/40 bg-cyan-400/20 text-cyan-200'
            : 'border-white/10 bg-white/[0.05] text-white/70 hover:bg-white/10'
        }`}
      >
        {playing ? <Pause size={15} /> : <Play size={15} className="ml-0.5" />}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <KindIcon size={11} className="shrink-0 text-violet-300/80" />
          <span className="truncate text-[13px] font-medium text-white/90">{sfx.prompt}</span>
        </div>
        <div className="font-mono text-[10px] text-white/35">
          {sfx.name} · {(sfx.bytes / 1024).toFixed(0)} KB · {sfx.provider}/{sfx.model || sfx.provider}
        </div>
        {sfx.lyrics && (
          <div className="mt-1 max-h-16 overflow-y-auto whitespace-pre-wrap rounded-md border border-white/[0.06] bg-black/30 p-1.5 font-mono text-[9px] leading-relaxed text-white/45">
            {sfx.lyrics}
          </div>
        )}
      </div>
      <a href={sfx.url} download={sfx.name} className="btn !px-2 !py-1.5" title="Download">
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
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
        <div className="flex items-center gap-2 text-[13px] font-semibold">
          <AudioWaveform size={15} className="text-cyan-300" /> {t('sfx.title')}
          <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-white/50">
            {sfxList.length}
          </span>
        </div>
        {/* kind selector */}
        <div className="flex rounded-lg border border-white/10 bg-black/30 p-0.5">
          {KIND_META.map(({ id, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setKind(id)}
              className={`flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-wide transition ${
                kind === id ? 'bg-violet-500/30 text-violet-100' : 'text-white/40 hover:text-white/70'
              }`}
            >
              <Icon size={11} />
              {t(`sfx.kind${id[0].toUpperCase()}${id.slice(1)}`)}
            </button>
          ))}
        </div>
      </div>
      <form onSubmit={generate} className="flex gap-2 border-b border-white/[0.06] p-2.5">
        <div className="relative flex-1">
          <Sparkles size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-violet-300/60" />
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={placeholder}
            className="w-full rounded-lg border border-white/10 bg-black/40 py-2 pl-8 pr-3 text-xs outline-none placeholder:text-white/30 focus:border-cyan-400/50"
          />
        </div>
        <button className="btn btn-primary !text-[11px]" disabled={generating || !prompt.trim()}>
          {generating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
          {t('sfx.generate')}
        </button>
      </form>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {sfxList.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-white/35">
            {t('sfx.empty')}
          </p>
        ) : (
          <ul className="space-y-1.5">
            {sfxList.map((s) => (
              <SfxRow key={s.id} sfx={s} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

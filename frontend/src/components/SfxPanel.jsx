import { useRef, useState } from 'react';
import { Play, Pause, Download, AudioWaveform, Loader2, Sparkles } from 'lucide-react';
import { api } from '../api.js';
import { toast, showToastError } from '../toast.js';

function SfxRow({ sfx }) {
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
        <div className="truncate text-[13px] font-medium text-white/90">{sfx.prompt}</div>
        <div className="font-mono text-[10px] text-white/35">
          {sfx.name} · {(sfx.bytes / 1024).toFixed(0)} KB · {sfx.provider}
        </div>
      </div>
      <a href={sfx.url} download={sfx.name} className="btn !px-2 !py-1.5" title="Download">
        <Download size={13} />
      </a>
    </li>
  );
}

export default function SfxPanel({ sfxList }) {
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);

  const generate = async (e) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    setGenerating(true);
    toast('Generating sound...', 'info');
    try {
      await api('/api/sfx', { method: 'POST', body: { prompt: prompt.trim() } });
      toast('SFX ready', 'success');
      setPrompt('');
    } catch (err) {
      showToastError(err);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="panel flex min-h-0 flex-col">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
        <div className="flex items-center gap-2 text-[13px] font-semibold">
          <AudioWaveform size={15} className="text-cyan-300" /> Sound FX
          <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-white/50">
            {sfxList.length}
          </span>
        </div>
      </div>
      <form onSubmit={generate} className="flex gap-2 border-b border-white/[0.06] p-2.5">
        <div className="relative flex-1">
          <Sparkles size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-violet-300/60" />
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe a sound — e.g. 'sword clash, metallic'"
            className="w-full rounded-lg border border-white/10 bg-black/40 py-2 pl-8 pr-3 text-xs outline-none placeholder:text-white/30 focus:border-cyan-400/50"
          />
        </div>
        <button className="btn btn-primary !text-[11px]" disabled={generating || !prompt.trim()}>
          {generating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
          Generate
        </button>
      </form>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {sfxList.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-white/35">
            Generated SFX appears here — ask Claude or use the form above.
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

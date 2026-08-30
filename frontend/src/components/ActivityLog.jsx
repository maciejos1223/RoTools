import { useEffect, useRef } from 'react';
import { Terminal, Trash2 } from 'lucide-react';
import { useI18n } from '../i18n.jsx';

const LEVEL_COLORS = {
  info: 'bg-sky-400',
  success: 'bg-emerald-400',
  warn: 'bg-amber-400',
  error: 'bg-red-400',
};

const TYPE_LABELS = {
  model: 'MODEL',
  sfx: 'SFX',
  roblox: 'STUDIO',
  server: 'SYS',
  asset: 'ASSET',
  import: 'IMPORT',
};

export default function ActivityLog({ activity, onClear }) {
  const { t } = useI18n();
  const scrollRef = useRef(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [activity]);

  return (
    <div className="panel flex min-h-0 flex-col">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
        <div className="flex items-center gap-2 text-[13px] font-semibold">
          <Terminal size={14} className="text-emerald-300" /> {t('log.title')}
        </div>
        <button className="btn !border-transparent !bg-transparent !px-2 !py-1 text-white/40 hover:!text-white/80" onClick={onClear} title={t('log.clear')}>
          <Trash2 size={13} />
        </button>
      </div>
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-2 font-mono text-[11px] leading-relaxed">
        {activity.length === 0 ? (
          <p className="py-4 text-center text-white/30">{t('log.empty')}</p>
        ) : (
          activity.map((a) => (
            <div key={a.id} className="flex items-start gap-2 py-[3px]">
              <span className={`mt-[5px] h-[6px] w-[6px] shrink-0 rounded-full ${LEVEL_COLORS[a.level] || 'bg-sky-400'}`} />
              <span className="shrink-0 text-white/25">{new Date(a.at).toLocaleTimeString()}</span>
              {TYPE_LABELS[a.type] && (
                <span className="shrink-0 rounded bg-white/[0.05] px-1 text-[9px] font-bold tracking-wider text-white/40">
                  {TYPE_LABELS[a.type]}
                </span>
              )}
              <span className={`min-w-0 break-words ${a.level === 'error' ? 'text-red-300/90' : a.level === 'success' ? 'text-emerald-200/85' : a.level === 'warn' ? 'text-amber-200/85' : 'text-white/65'}`}>
                {a.message}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

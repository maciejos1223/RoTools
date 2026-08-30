import { useEffect, useRef } from 'react';
import { Trash2 } from 'lucide-react';
import { useI18n } from '../i18n.jsx';

const LEVEL_DOT = {
  info: 'bg-[var(--text-3)]',
  success: 'bg-[var(--ok)]',
  warn: 'bg-[var(--warn)]',
  error: 'bg-[var(--err)]',
};

const TYPE_LABEL = {
  model: 'MODEL',
  sfx: 'AUDIO',
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
      <div className="panel-header" style={{ minHeight: 38 }}>
        <div className="panel-title">{t('log.title')}</div>
        <button className="btn btn-icon btn-ghost" onClick={onClear} title={t('log.clear')}>
          <Trash2 size={12} />
        </button>
      </div>
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {activity.length === 0 ? (
          <p className="py-3 text-center text-[11.5px] text-[var(--text-3)]">{t('log.empty')}</p>
        ) : (
          activity.map((a) => (
            <div key={a.id} className="flex items-start gap-2 py-[2.5px] font-mono text-[10.5px] leading-relaxed">
              <span className={`dot mt-[4px] !h-[5px] !w-[5px] ${LEVEL_DOT[a.level] || LEVEL_DOT.info}`} />
              <span className="shrink-0 text-[var(--text-3)]">{new Date(a.at).toLocaleTimeString()}</span>
              {TYPE_LABEL[a.type] && (
                <span className="shrink-0 text-[9px] font-semibold tracking-wider text-[var(--text-3)]">
                  {TYPE_LABEL[a.type]}
                </span>
              )}
              <span className={`min-w-0 break-words ${
                a.level === 'error' ? 'text-[var(--err)]' :
                a.level === 'success' ? 'text-[var(--ok)]' :
                a.level === 'warn' ? 'text-[var(--warn)]' : 'text-[var(--text-2)]'
              }`}>
                {a.message}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

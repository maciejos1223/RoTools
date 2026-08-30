import { useEffect, useRef } from 'react';
import { Trash2 } from 'lucide-react';
import { useI18n } from '../i18n.jsx';

const LEVEL_DOT = {
  info: 'bg-[var(--text-3)]',
  success: 'bg-[var(--ok)]',
  warn: 'bg-[var(--warn)]',
  error: 'bg-[var(--err)]',
};

const LEVEL_TEXT = {
  info: 'text-[var(--text-2)]',
  success: 'text-[var(--ok)]',
  warn: 'text-[var(--warn)]',
  error: 'text-[var(--err)]',
};

const TYPE_LABEL = {
  model: 'MODEL',
  sfx: 'AUDIO',
  roblox: 'STUDIO',
  server: 'SYS',
  asset: 'ASSET',
  import: 'IMPORT',
};

export default function ActivityLog({ activity, onClear, full = false }) {
  const { t } = useI18n();
  const scrollRef = useRef(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [activity]);

  return (
    <div className="panel flex h-full min-h-0 flex-col">
      <div className="panel-header">
        <div className="panel-title">{t('log.title')}</div>
        <button className="btn btn-icon btn-ghost" onClick={onClear} title={t('log.clear')}>
          <Trash2 size={13} />
        </button>
      </div>
      <div
        ref={scrollRef}
        className={`min-h-0 flex-1 overflow-y-auto ${full ? 'px-4 py-3' : 'px-3 py-2'}`}
      >
        {activity.length === 0 ? (
          <p className={`text-center text-[var(--text-3)] ${full ? 'py-10 text-[13px]' : 'py-3 text-[12px]'}`}>
            {t('log.empty')}
          </p>
        ) : (
          activity.map((a) => (
            <div
              key={a.id}
              className={`flex items-start gap-2.5 font-mono leading-relaxed ${full ? 'py-1.5 text-[12px]' : 'py-[3px] text-[11px]'}`}
            >
              <span className={`dot mt-[5px] !h-[6px] !w-[6px] ${LEVEL_DOT[a.level] || LEVEL_DOT.info}`} />
              <span className="shrink-0 text-[var(--text-3)]">{new Date(a.at).toLocaleTimeString()}</span>
              {TYPE_LABEL[a.type] && (
                <span className="w-[54px] shrink-0 text-[10px] font-semibold tracking-wider text-[var(--text-3)]">
                  {TYPE_LABEL[a.type]}
                </span>
              )}
              <span className={`min-w-0 break-words ${LEVEL_TEXT[a.level] || LEVEL_TEXT.info}`}>{a.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

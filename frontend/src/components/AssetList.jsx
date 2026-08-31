import { useState } from 'react';
import { Copy, Check, Download, Send, Loader2, PackageCheck, Wrench, X, Cuboid } from 'lucide-react';
import { api } from '../api.js';
import { useI18n } from '../i18n.jsx';
import { toast, showToastError } from '../toast.js';

function CopyChip({ id }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(id);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = id;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(true);
    toast(`${t('assets.toastCopied')} ${id}`, 'info');
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button className="chip" onClick={copy} title="Copy asset ID">
      {copied ? <Check size={11} className="text-[var(--ok)]" /> : <Copy size={11} />}
      {id}
    </button>
  );
}

export default function AssetList({ assets, editRequests = [] }) {
  const { t } = useI18n();
  const [importing, setImporting] = useState(null);
  const [fixingId, setFixingId] = useState(null);
  const [fixText, setFixText] = useState('');

  const submitFix = async (asset) => {
    const feedback = fixText.trim();
    if (!feedback) return;
    try {
      await api(`/api/assets/${asset.id}/edit`, { method: 'POST', body: { feedback } });
      toast(t('assets.toastFixSent'), 'success');
      setFixingId(null);
      setFixText('');
    } catch (err) {
      showToastError(err);
    }
  };

  const cancelFix = async (asset) => {
    try {
      await api(`/api/assets/${asset.id}/edit`, { method: 'DELETE' });
      toast(t('assets.toastFixCancelled'), 'info');
    } catch (err) {
      showToastError(err);
    }
  };

  const importToStudio = async (asset) => {
    setImporting(asset.id);
    toast(t('assets.toastSending'), 'info');
    try {
      await api(`/api/assets/${asset.id}/import`, { method: 'POST' });
      toast(t('assets.toastQueued'), 'success');
    } catch (err) {
      showToastError(err);
    } finally {
      setTimeout(() => setImporting(null), 800);
    }
  };

  return (
    <div className="panel flex h-full min-h-0 flex-col">
      <div className="panel-header">
        <div className="flex items-center gap-2">
          <Cuboid size={15} className="text-[var(--text-3)]" />
          <div className="panel-title">{t('assets.title')}</div>
          <span className="mono text-[11.5px] text-[var(--text-3)]">{assets.length}</span>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {assets.length === 0 ? (
          <p className="px-4 py-12 text-center text-[13.5px] text-[var(--text-3)]">{t('assets.empty')}</p>
        ) : (
          <ul className="space-y-2">
            {assets.map((a) => {
              const fix = editRequests.find((e) => e.assetId === a.id);
              return (
                <li
                  key={a.id}
                  className="fade-up flex items-center gap-3.5 rounded-lg border border-transparent px-3 py-3 transition hover:border-[var(--line)] hover:bg-[var(--surface-2)]"
                >
                  {a.thumbUrl ? (
                    <img
                      src={a.thumbUrl}
                      alt={a.name}
                      className="h-14 w-14 shrink-0 rounded-lg border border-[var(--line)] bg-[var(--bg)] object-contain"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-[var(--line)] text-[var(--text-3)]">
                      <Cuboid size={18} strokeWidth={1.5} />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2.5">
                        <span className="truncate text-[14.5px] font-medium text-[var(--text)]">{a.name}</span>
                        {a.imported && (
                          <span className="badge flex items-center gap-1 border border-[rgba(76,199,138,0.35)] text-[var(--ok)]">
                            <PackageCheck size={10} /> {t('assets.inStudio')}
                          </span>
                        )}
                        {fix && (
                          <span className="badge badge-lime flex items-center gap-1.5">
                            <Wrench size={9} /> {t('assets.fixRequested')}
                            <button onClick={() => cancelFix(a)} title={t('assets.cancelFix')} className="hover:opacity-60">
                              <X size={10} />
                            </button>
                          </span>
                        )}
                      </div>
                      <div className="mt-1.5 flex items-center gap-2.5">
                        <CopyChip id={a.id} />
                        <span className="mono tnum text-[11px] text-[var(--text-3)]">
                          {new Date(a.createdAt).toLocaleString()}
                        </span>
                        {a.robloxRef && (
                          <span className="mono truncate text-[11px] text-[var(--text-3)]">
                            {t('assets.workspace')}: <span className="text-[var(--ok)]">{a.robloxRef}</span>
                          </span>
                        )}
                      </div>
                      {fix && (
                        <div className="mt-2 text-[12px] text-[var(--text-2)]">
                          <Wrench size={11} className="mr-1.5 inline text-[var(--text-3)]" />
                          {fix.feedback}
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      {!fix && (
                        <button
                          className="btn btn-sm"
                          onClick={() => { setFixingId(fixingId === a.id ? null : a.id); setFixText(''); }}
                          title={t('assets.editHint')}
                        >
                          <Wrench size={13} /> {t('assets.edit')}
                        </button>
                      )}
                      {!a.imported && (
                        <button
                          className="btn btn-primary btn-sm"
                          disabled={importing === a.id}
                          onClick={() => importToStudio(a)}
                          title="Import into Roblox Studio"
                        >
                          {importing === a.id ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                          {t('assets.import')}
                        </button>
                      )}
                      <a className="btn btn-sm" href={a.glbUrl} download={`${a.name}.glb`}>
                        <Download size={13} /> {t('assets.download')}
                      </a>
                    </div>
                  {fixingId === a.id && (
                    <div className="fade-up mt-3 flex gap-2">
                      <input
                        autoFocus
                        value={fixText}
                        onChange={(e) => setFixText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && submitFix(a)}
                        placeholder={t('assets.editPlaceholder')}
                        className="input flex-1"
                      />
                      <button className="btn btn-primary btn-sm" disabled={!fixText.trim()} onClick={() => submitFix(a)}>
                        {t('assets.sendFix')}
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setFixingId(null)}>
                        {t('settings.close')}
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

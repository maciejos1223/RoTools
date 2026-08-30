import { useState } from 'react';
import { Copy, Check, Download, Send, Loader2, PackageCheck, Cuboid } from 'lucide-react';
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

export default function AssetList({ assets }) {
  const { t } = useI18n();
  const [importing, setImporting] = useState(null);

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
            {assets.map((a) => (
              <li
                key={a.id}
                className="fade-up flex items-center justify-between gap-4 rounded-lg border border-transparent px-4 py-3.5 transition hover:border-[var(--line)] hover:bg-[var(--surface-2)]"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5">
                    <span className="truncate text-[14.5px] font-medium text-[var(--text)]">{a.name}</span>
                    {a.imported && (
                      <span className="badge flex items-center gap-1 border border-[rgba(76,199,138,0.35)] text-[var(--ok)]">
                        <PackageCheck size={10} /> {t('assets.inStudio')}
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 flex items-center gap-2.5">
                    <CopyChip id={a.id} />
                    <span className="mono text-[11px] text-[var(--text-3)]">
                      {new Date(a.createdAt).toLocaleString()}
                    </span>
                    {a.robloxRef && (
                      <span className="mono truncate text-[11px] text-[var(--text-3)]">
                        {t('assets.workspace')}: <span className="text-[var(--ok)]">{a.robloxRef}</span>
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
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
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

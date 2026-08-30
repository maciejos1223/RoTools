import { useState } from 'react';
import { Copy, Check, Download, Cuboid, Send, Loader2, PackageCheck } from 'lucide-react';
import { api } from '../api.js';
import { toast, showToastError } from '../toast.js';

function CopyChip({ id }) {
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
    toast(`Copied ${id}`, 'info');
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button className="chip inline-flex items-center gap-1" onClick={copy} title="Copy asset ID">
      {copied ? <Check size={11} /> : <Copy size={11} />}
      {id}
    </button>
  );
}

export default function AssetList({ assets }) {
  const [importing, setImporting] = useState(null);

  const importToStudio = async (asset) => {
    setImporting(asset.id);
    toast(`Sending "${asset.name}" to Roblox Studio...`, 'info');
    try {
      await api(`/api/assets/${asset.id}/import`, { method: 'POST' });
      toast('Queued — Roblox Studio plugin will pick it up', 'success');
    } catch (err) {
      showToastError(err);
    } finally {
      setTimeout(() => setImporting(null), 800);
    }
  };

  return (
    <div className="panel flex min-h-0 flex-col">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
        <div className="flex items-center gap-2 text-[13px] font-semibold">
          <Cuboid size={15} className="text-violet-300" /> Assets
          <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-white/50">
            {assets.length}
          </span>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {assets.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-white/35">
            Accepted models land here with their asset ID.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {assets.map((a) => (
              <li key={a.id} className="fade-up group rounded-xl border border-white/[0.05] bg-white/[0.02] p-2.5 transition hover:border-white/[0.1] hover:bg-white/[0.045]">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[13px] font-medium text-white/90">{a.name}</span>
                      {a.imported ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-300">
                          <PackageCheck size={10} /> in studio
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <CopyChip id={a.id} />
                      <span className="font-mono text-[10px] text-white/30">
                        {new Date(a.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    {!a.imported && (
                      <button
                        className="btn btn-primary !px-2.5 !py-1.5 !text-[11px]"
                        disabled={importing === a.id}
                        onClick={() => importToStudio(a)}
                        title="Import into Roblox Studio"
                      >
                        {importing === a.id ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                        Import
                      </button>
                    )}
                    <a className="btn !px-2.5 !py-1.5 !text-[11px]" href={a.glbUrl} download={`${a.name}.glb`}>
                      <Download size={12} /> GLB
                    </a>
                  </div>
                </div>
                {a.robloxRef && (
                  <div className="mt-1.5 font-mono text-[10px] text-emerald-300/70">
                    Workspace: {a.robloxRef}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

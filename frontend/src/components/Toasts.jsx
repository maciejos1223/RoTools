import { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info, XCircle } from 'lucide-react';

const STYLES = {
  success: { icon: CheckCircle2, cls: 'border-emerald-400/30 bg-emerald-950/80 text-emerald-200' },
  error: { icon: XCircle, cls: 'border-red-400/30 bg-red-950/80 text-red-200' },
  warn: { icon: AlertTriangle, cls: 'border-amber-400/30 bg-amber-950/80 text-amber-200' },
  info: { icon: Info, cls: 'border-violet-400/30 bg-[#141327]/90 text-violet-100' },
};

export default function Toasts() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    const handler = (e) => {
      const item = { ...e.detail, at: Date.now() };
      setItems((prev) => [...prev.slice(-4), item]);
      setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== item.id)), 3800);
    };
    window.addEventListener('rotools-toast', handler);
    return () => window.removeEventListener('rotools-toast', handler);
  }, []);

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2">
      {items.map((t) => {
        const S = STYLES[t.type] || STYLES.info;
        const Icon = S.icon;
        return (
          <div key={t.id} className={`fade-up pointer-events-auto flex max-w-sm items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-[13px] font-medium shadow-2xl backdrop-blur ${S.cls}`}>
            <Icon size={16} className="shrink-0" />
            {t.message}
          </div>
        );
      })}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info, XCircle } from 'lucide-react';

const ICONS = {
  success: { icon: CheckCircle2, color: 'var(--ok)' },
  error: { icon: XCircle, color: 'var(--err)' },
  warn: { icon: AlertTriangle, color: 'var(--warn)' },
  info: { icon: Info, color: 'var(--primary)' },
};

export default function Toasts() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    const handler = (e) => {
      const item = { ...e.detail, at: Date.now() };
      setItems((prev) => [...prev.slice(-4), item]);
      setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== item.id)), 3600);
    };
    window.addEventListener('rotools-toast', handler);
    return () => window.removeEventListener('rotools-toast', handler);
  }, []);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      {items.map((item) => {
        const M = ICONS[item.type] || ICONS.info;
        const Icon = M.icon;
        return (
          <div
            key={item.id}
            className="fade-up pointer-events-auto flex max-w-sm items-center gap-2.5 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3.5 py-2.5 text-[12.5px] shadow-[var(--shadow-pop)]"
          >
            <Icon size={15} className="shrink-0" style={{ color: M.color }} />
            <span className="text-[var(--text)]">{item.message}</span>
          </div>
        );
      })}
    </div>
  );
}

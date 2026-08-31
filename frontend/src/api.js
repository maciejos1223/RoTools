import { useEffect, useRef, useState, useCallback } from 'react';

export async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

/**
 * Live app state: initial fetch + SSE-driven refresh.
 */
export function useAppState() {
  const [state, setState] = useState(null);
  const [connected, setConnected] = useState(false);
  const stateRef = useRef(null);
  stateRef.current = state;

  const refresh = useCallback(async () => {
    try {
      const s = await api('/api/state');
      setState(s);
    } catch {
      /* server offline — keep last state */
    }
  }, []);

  useEffect(() => {
    refresh();
    const es = new EventSource('/api/events');
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    const events = ['model', 'asset', 'sfx', 'import', 'roblox', 'activity', 'edit'];
    events.forEach((name) => es.addEventListener(name, () => setTimeout(refresh, 30)));
    return () => es.close();
  }, [refresh]);

  return { state, connected, refresh };
}

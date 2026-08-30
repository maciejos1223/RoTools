import { useEffect, useState } from 'react';
import { X, Save, Loader2, ShieldCheck, RotateCcw, Settings as SettingsIcon } from 'lucide-react';
import { api } from '../api.js';
import { useI18n } from '../i18n.jsx';
import { toast, showToastError } from '../toast.js';

const SECRET = 'secret';

const SECTIONS = [
  {
    id: 'general',
    fields: [{ section: 'root', key: 'port', type: 'number', labelKey: 'port', hintKey: 'portHint' }],
  },
  {
    id: 'sfx',
    test: true,
    fields: [
      { section: 'sfx', key: 'provider', type: 'select', options: ['elevenlabs', 'google', 'custom'], labelKey: 'provider' },
      { section: 'sfx', key: 'api_key', type: SECRET, labelKey: 'apiKey' },
      { section: 'sfx', key: 'google_api_key', type: SECRET, labelKey: 'googleApiKey' },
      { section: 'sfx', key: 'voice', type: 'text', labelKey: 'voice', hintKey: 'voiceHint' },
      { section: 'sfx', key: 'model', type: 'text', labelKey: 'model' },
      { section: 'sfx', key: 'endpoint', type: 'text', labelKey: 'endpoint' },
    ],
  },
  {
    id: 'music',
    test: true,
    fields: [
      { section: 'music', key: 'provider', type: 'select', options: ['google', 'custom'], labelKey: 'provider' },
      { section: 'music', key: 'api_key', type: SECRET, labelKey: 'googleApiKey' },
      { section: 'music', key: 'model', type: 'text', labelKey: 'model', hintKey: 'musicModelHint' },
      { section: 'music', key: 'endpoint', type: 'text', labelKey: 'endpoint' },
    ],
  },
  {
    id: 'export',
    fields: [
      { section: 'export', key: 'default_format', type: 'select', options: ['glb', 'gltf', 'obj'], labelKey: 'defaultFormat' },
      { section: 'export', key: 'output_dir', type: 'text', labelKey: 'outputDir' },
    ],
  },
];

export default function SettingsModal({ onClose }) {
  const { t } = useI18n();
  const [draft, setDraft] = useState(null); // { "section.key": value } ; secrets: {set, masked, val, clear}
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(null);

  useEffect(() => {
    api('/api/config')
      .then((cfg) => {
        const d = { '_root.port': String(cfg.port) };
        for (const s of SECTIONS) {
          for (const f of s.fields) {
            if (f.section === 'root') continue;
            const raw = cfg[f.section]?.[f.key];
            d[`${f.section}.${f.key}`] =
              f.type === SECRET
                ? { set: !!raw?.set, masked: raw?.masked || '', val: '', clear: false }
                : raw ?? '';
          }
        }
        setDraft(d);
      })
      .catch((err) => {
        showToastError(err);
        onClose();
      });
  }, [onClose]);

  const setField = (id, value) => setDraft((d) => ({ ...d, [id]: value }));

  const setSecret = (id, patch) =>
    setDraft((d) => ({ ...d, [id]: { ...d[id], ...patch, clear: patch.clear ?? false, val: patch.val ?? d[id].val } }));

  const save = async () => {
    setSaving(true);
    try {
      const patch = { sfx: {}, music: {}, export: {} };
      const port = parseInt(draft['_root.port'], 10);
      if (Number.isFinite(port)) patch.port = port;

      for (const s of SECTIONS) {
        for (const f of s.fields) {
          if (f.section === 'root') continue;
          const id = `${f.section}.${f.key}`;
          if (f.type === SECRET) {
            const sec = draft[id];
            if (sec.clear) patch[f.section][f.key] = '';
            else if (sec.val.length > 0) patch[f.section][f.key] = sec.val;
          } else {
            patch[f.section][f.key] = draft[id];
          }
        }
      }
      const res = await api('/api/config', { method: 'POST', body: patch });
      setDraft((d) => {
        const nd = { ...d, '_root.port': String(res.config.port) };
        for (const s of SECTIONS) {
          for (const f of s.fields) {
            if (f.type === SECRET) {
              const raw = res.config[f.section][f.key];
              nd[`${f.section}.${f.key}`] = { set: raw?.set, masked: raw?.masked || '', val: '', clear: false };
            }
          }
        }
        return nd;
      });
      toast(t('settings.saved'), 'success');
    } catch (err) {
      showToastError(err);
    } finally {
      setSaving(false);
    }
  };

  const testSection = async (id) => {
    setTesting(id);
    try {
      const r = await api('/api/config/test', { method: 'POST', body: { section: id } });
      toast(r.message || (r.ok ? t('settings.testOk') : t('settings.testFail')), r.ok ? 'success' : 'error');
    } catch (err) {
      showToastError(err);
    } finally {
      setTesting(null);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="panel glow-accent max-h-[88vh] w-full max-w-2xl overflow-y-auto p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[15px] font-bold">
            <SettingsIcon size={17} className="text-violet-300" />
            {t('settings.title')}
          </div>
          <button className="btn !px-2 !py-1.5" onClick={onClose}>
            <X size={15} />
          </button>
        </div>

        {!draft ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-white/60">
            <Loader2 size={16} className="animate-spin" /> Loading...
          </div>
        ) : (
          <div className="space-y-5">
            {SECTIONS.map((s) => (
              <div key={s.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-[12px] font-bold uppercase tracking-wider text-white/70">
                    {t(`settings.section_${s.id}`)}
                  </div>
                  {s.test && (
                    <button className="btn !px-2.5 !py-1.5 !text-[11px]" disabled={testing === s.id} onClick={() => testSection(s.id)}>
                      {testing === s.id ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} />}
                      {t('settings.test')}
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {s.fields.map((f) => {
                    const id = f.section === 'root' ? '_root.port' : `${f.section}.${f.key}`;
                    const val = f.section === 'root' ? draft._root.port : draft[id];
                    return (
                      <Field
                        key={id}
                        field={f}
                        value={val}
                        onChange={(v) => (f.section === 'root' ? setField(id, v) : setField(id, v))}
                        onSecret={(patch) => setSecret(id, patch)}
                      />
                    );
                  })}
                </div>
              </div>
            ))}

            <div className="flex items-center justify-between">
              <div className="text-[11px] text-white/35">{t('settings.saveHint')}</div>
              <div className="flex gap-2">
                <button className="btn" onClick={onClose}>
                  {t('settings.close')}
                </button>
                <button className="btn btn-primary" disabled={saving} onClick={save}>
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  {saving ? t('settings.saving') : t('settings.save')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ field, value, onChange, onSecret }) {
  const { t } = useI18n();
  const label = t(`settings.${field.labelKey}`);

  if (field.type === SECRET) {
    const sec = value;
    return (
      <div>
        <label className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-white/60">
          {label}
          <span
            className={`h-[6px] w-[6px] rounded-full ${sec.set ? 'bg-emerald-400' : 'bg-white/20'}`}
            title={sec.set ? t('settings.keySet') : t('settings.keyNotSet')}
          />
          {sec.set && (
            <button
              className="ml-auto inline-flex items-center gap-1 text-[10px] font-medium text-white/30 hover:text-red-300"
              onClick={() => onSecret({ clear: true, val: '' })}
              title={t('settings.clear')}
            >
              <RotateCcw size={10} /> {t('settings.clear')}
            </button>
          )}
        </label>
        <input
          type="password"
          autoComplete="off"
          value={sec.clear ? '' : sec.val}
          placeholder={sec.clear ? t('settings.willClear') : sec.set ? sec.masked : t('settings.keyNotSet')}
          onChange={(e) => onSecret({ val: e.target.value })}
          className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 font-mono text-xs outline-none placeholder:text-white/25 focus:border-violet-400/50"
        />
      </div>
    );
  }

  if (field.type === 'select') {
    return (
      <div>
        <label className="mb-1 block text-[11px] font-semibold text-white/60">{label}</label>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white/90 outline-none focus:border-violet-400/50 [&>option]:bg-[#12141d]"
        >
          {field.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        {field.hintKey && <Hint text={t(`settings.${field.hintKey}`)} />}
      </div>
    );
  }

  return (
    <div>
      <label className="mb-1 block text-[11px] font-semibold text-white/60">{label}</label>
      <input
        type={field.type === 'number' ? 'number' : 'text'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 font-mono text-xs outline-none placeholder:text-white/25 focus:border-violet-400/50"
      />
      {field.hintKey && <Hint text={t(`settings.${field.hintKey}`)} />}
    </div>
  );
}

function Hint({ text }) {
  if (!text) return null;
  return <div className="mt-1 text-[10px] leading-tight text-amber-200/50">{text}</div>;
}

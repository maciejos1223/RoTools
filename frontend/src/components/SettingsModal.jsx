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
  const [draft, setDraft] = useState(null);
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
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="panel max-h-[88vh] w-full max-w-2xl overflow-y-auto !rounded-xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="panel-header">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-[var(--text)]">
            <SettingsIcon size={14} className="text-[var(--text-3)]" />
            {t('settings.title')}
          </div>
          <button className="btn btn-icon btn-ghost" onClick={onClose}>
            <X size={14} />
          </button>
        </div>

        {!draft ? (
          <div className="flex items-center justify-center gap-2 py-14 text-[12.5px] text-[var(--text-3)]">
            <Loader2 size={15} className="animate-spin" /> Loading...
          </div>
        ) : (
          <div className="p-4">
            {SECTIONS.map((s, i) => (
              <div key={s.id} className={i > 0 ? 'mt-4 border-t border-[var(--line)] pt-4' : ''}>
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--text-3)]">
                    {t(`settings.section_${s.id}`)}
                  </div>
                  {s.test && (
                    <button className="btn btn-sm" disabled={testing === s.id} onClick={() => testSection(s.id)}>
                      {testing === s.id ? <Loader2 size={11} className="animate-spin" /> : <ShieldCheck size={11} />}
                      {t('settings.test')}
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {s.fields.map((f) => {
                    const id = f.section === 'root' ? '_root.port' : `${f.section}.${f.key}`;
                    const val = f.section === 'root' ? draft['_root.port'] : draft[id];
                    return (
                      <Field
                        key={id}
                        field={f}
                        value={val}
                        onChange={(v) => setField(id, v)}
                        onSecret={(patch) => setSecret(id, patch)}
                      />
                    );
                  })}
                </div>
              </div>
            ))}

            <div className="mt-5 flex items-center justify-between gap-3">
              <div className="text-[11px] leading-snug text-[var(--text-3)]">{t('settings.saveHint')}</div>
              <div className="flex shrink-0 gap-2">
                <button className="btn" onClick={onClose}>
                  {t('settings.close')}
                </button>
                <button className="btn btn-primary" disabled={saving} onClick={save}>
                  {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
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
        <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-[var(--text-2)]">
          {label}
          <span className={`dot !h-[5px] !w-[5px] ${sec.set ? 'dot-ok' : 'dot-off'}`} title={sec.set ? t('settings.keySet') : t('settings.keyNotSet')} />
          {sec.set && (
            <button
              className="ml-auto inline-flex items-center gap-1 text-[10px] text-[var(--text-3)] transition hover:text-[var(--err)]"
              onClick={() => onSecret({ clear: true, val: '' })}
              title={t('settings.clear')}
            >
              <RotateCcw size={9} /> {t('settings.clear')}
            </button>
          )}
        </label>
        <input
          type="password"
          autoComplete="off"
          value={sec.clear ? '' : sec.val}
          placeholder={sec.clear ? t('settings.willClear') : sec.set ? sec.masked : t('settings.keyNotSet')}
          onChange={(e) => onSecret({ val: e.target.value })}
          className="input mono !text-[11.5px]"
        />
      </div>
    );
  }

  if (field.type === 'select') {
    return (
      <div>
        <label className="mb-1.5 block text-[11px] font-medium text-[var(--text-2)]">{label}</label>
        <select className="input mono" value={value} onChange={(e) => onChange(e.target.value)}>
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
      <label className="mb-1.5 block text-[11px] font-medium text-[var(--text-2)]">{label}</label>
      <input
        type={field.type === 'number' ? 'number' : 'text'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input mono"
      />
      {field.hintKey && <Hint text={t(`settings.${field.hintKey}`)} />}
    </div>
  );
}

function Hint({ text }) {
  if (!text) return null;
  return <div className="mt-1 text-[10px] leading-snug text-[var(--text-3)]">{text}</div>;
}

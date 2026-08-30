import { createContext, useContext, useEffect, useState } from 'react';

const dict = {
  en: {
    app: { subtitle: 'ROBLOX MCP STUDIO' },
    status: {
      live: 'Live',
      liveOk: 'SSE event stream connected',
      liveErr: 'Event stream disconnected — is the server running?',
      api: 'API',
      apiOk: 'Server is up',
      apiErr: 'Server offline — run: npm run dev',
      roblox: 'Roblox Studio',
      robloxOk: 'Plugin connected',
      robloxErr: 'Plugin offline — open Studio with the RoTools plugin',
    },
    viewer: {
      textures: 'Textures',
      wireframe: 'Wireframe',
      autorotate: 'Auto-rotate',
      loading: 'Loading model...',
      emptyTitle: 'No model yet',
      emptyDesc: 'Ask Claude to generate something, e.g.',
      emptyExample: '"Make me a mossy rock with textures"',
      emptySuffix: '. The preview will appear here.',
      meshes: 'meshes',
      tris: 'tris',
      hint: 'Review the model, then decide. Accepted models go to',
      hintAssets: 'Assets',
      feedbackPlaceholder: 'What should be different? (optional feedback for Claude)',
      accept: 'Accept',
      reject: 'Reject',
      regenerate: 'Regenerate',
      toastAccepted: 'Model accepted → added to assets',
      toastRejected: 'Model rejected — tell Claude what to change',
      toastRegenerating: 'Regenerating model...',
    },
    assets: {
      title: 'Assets',
      empty: 'Accepted models land here with their asset ID.',
      import: 'Import',
      download: 'GLB',
      inStudio: 'IN STUDIO',
      workspace: 'Workspace',
      toastSending: 'Sending to Roblox Studio...',
      toastQueued: 'Queued — Roblox Studio plugin will pick it up',
      toastCopied: 'Copied',
    },
    sfx: {
      title: 'Sound FX',
      placeholderSfx: "Describe a sound — e.g. 'sword clash, metallic'",
      placeholderVoice: "Describe a voice line — e.g. 'old wizard says: welcome, traveler'",
      placeholderMusic: "Describe a track — e.g. 'upbeat chiptune boss battle'",
      generate: 'Generate',
      empty: 'Generated audio appears here — ask Claude or use the form above.',
      toastGenerating: 'Generating audio...',
      toastReady: 'Audio ready',
      toastErrNoKey: 'No API key configured — see server/config.json',
      kindSfx: 'SFX',
      kindVoice: 'Voice',
      kindMusic: 'Music',
    },
    log: {
      title: 'Activity',
      empty: '— no activity yet —',
      clear: 'Clear',
    },
  },
  pl: {
    app: { subtitle: 'ROBLOX MCP STUDIO' },
    status: {
      live: 'Na żywo',
      liveOk: 'Strumień zdarzeń (SSE) połączony',
      liveErr: 'Strumień zdarzeń rozłączony — czy serwer działa?',
      api: 'API',
      apiOk: 'Serwer działa',
      apiErr: 'Serwer offline — uruchom: npm run dev',
      roblox: 'Roblox Studio',
      robloxOk: 'Plugin połączony',
      robloxErr: 'Plugin offline — otwórz Studio z pluginem RoTools',
    },
    viewer: {
      textures: 'Tekstury',
      wireframe: 'Siatka',
      autorotate: 'Autoobrót',
      loading: 'Wczytywanie modelu...',
      emptyTitle: 'Brak modelu',
      emptyDesc: 'Poproś Claude o wygenerowanie czegoś, np.',
      emptyExample: '"Zrób mi omszałą skałę z teksturą"',
      emptySuffix: '. Podgląd pojawi się tutaj.',
      meshes: 'meshy',
      tris: 'trójkąty',
      hint: 'Obejrzyj model i zdecyduj. Zaakceptowane trafią do',
      hintAssets: 'Assetów',
      feedbackPlaceholder: 'Co ma być inne? (opcjonalny feedback dla Claude)',
      accept: 'Akceptuj',
      reject: 'Odrzuć',
      regenerate: 'Generuj ponownie',
      toastAccepted: 'Model zaakceptowany → dodany do assetów',
      toastRejected: 'Model odrzucony — powiedz Claude co zmienić',
      toastRegenerating: 'Generowanie ponownie...',
    },
    assets: {
      title: 'Assety',
      empty: 'Zaakceptowane modele pojawią się tutaj wraz z ich ID.',
      import: 'Importuj',
      download: 'GLB',
      inStudio: 'W STUDIO',
      workspace: 'Workspace',
      toastSending: 'Wysyłam do Roblox Studio...',
      toastQueued: 'W kolejce — plugin Roblox Studio odbierze import',
      toastCopied: 'Skopiowano',
    },
    sfx: {
      title: 'Dźwięki',
      placeholderSfx: "Opisz dźwięk — np. 'zderzenie mieczy, metaliczne'",
      placeholderVoice: "Opisz kwestię głosową — np. 'stary czarodziej mówi: witaj, wędrowcze'",
      placeholderMusic: "Opisz utwór — np. 'żywiołowy chiptune na walkę z bossem'",
      generate: 'Generuj',
      empty: 'Wygenerowane audio pojawi się tutaj — poproś Claude lub użyj formularza.',
      toastGenerating: 'Generowanie dźwięku...',
      toastReady: 'Dźwięk gotowy',
      toastErrNoKey: 'Brak klucza API — zobacz server/config.json',
      kindSfx: 'SFX',
      kindVoice: 'Głos',
      kindMusic: 'Muzyka',
    },
    log: {
      title: 'Aktywność',
      empty: '— brak aktywności —',
      clear: 'Wyczyść',
    },
  },
};

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(() => {
    try {
      return localStorage.getItem('rotools_lang') || 'en';
    } catch {
      return 'en';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('rotools_lang', lang);
    } catch { /* private mode */ }
    document.documentElement.lang = lang;
  }, [lang]);

  const t = (key, fallback) => {
    const val = key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), dict[lang]);
    return val ?? fallback ?? key;
  };

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}

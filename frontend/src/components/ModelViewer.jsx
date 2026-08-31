import { Suspense, useEffect, useRef, useState } from 'react';
import { Canvas, useLoader } from '@react-three/fiber';
import { OrbitControls, Grid, ContactShadows, Center, Bounds, useProgress } from '@react-three/drei';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  Box, Eye, EyeOff, RotateCw, Loader2, Check, X, RefreshCw,
} from 'lucide-react';
import { api } from '../api.js';
import { useI18n } from '../i18n.jsx';
import { toast, showToastError } from '../toast.js';

function Model({ url, showTextures, wireframe }) {
  const gltf = useLoader(GLTFLoader, url);

  useEffect(() => {
    gltf.scene.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        if (o.material && o.userData._origMap === undefined) o.userData._origMap = o.material.map || null;
      }
    });
  }, [gltf]);

  useEffect(() => {
    gltf.scene.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      const orig = o.userData._origMap || null;
      o.material.map = showTextures ? orig : null;
      o.material.needsUpdate = true;
      o.material.wireframe = wireframe;
    });
  }, [gltf, showTextures, wireframe]);

  return (
    <Center>
      <Bounds fit clip observe margin={1.15}>
        <primitive object={gltf.scene} />
      </Bounds>
    </Center>
  );
}

function Rig({ autoRotate }) {
  const controls = useRef();
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      autoRotate={autoRotate}
      autoRotateSpeed={1.1}
      enableDamping
      dampingFactor={0.08}
      minDistance={0.5}
      maxDistance={60}
      maxPolarAngle={Math.PI / 1.9}
    />
  );
}

export default function ModelViewer({ pendingModel }) {
  const { t } = useI18n();
  const [showTextures, setShowTextures] = useState(true);
  const [wireframe, setWireframe] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const [busy, setBusy] = useState(null);

  const url = pendingModel?.glbUrl || null;

  const act = async (action, body) => {
    setBusy(action);
    try {
      await api(`/api/models/${pendingModel.id}/${action}`, { method: 'POST', body });
      toast(
        action === 'accept' ? t('viewer.toastAccepted') :
        action === 'reject' ? t('viewer.toastRejected') :
        t('viewer.toastRegenerating'),
        action === 'accept' ? 'success' : action === 'reject' ? 'warn' : 'info'
      );
    } catch (err) {
      showToastError(err);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="panel relative min-h-[420px] flex-1 overflow-hidden">
      {url ? (
        <Canvas shadows dpr={[1, 2]} camera={{ position: [4.5, 3, 4.5], fov: 42 }}>
          <color attach="background" args={['#212226']} />
          <fog attach="fog" args={['#212226', 20, 46]} />
          <ambientLight intensity={0.6} />
          <directionalLight position={[5, 8, 4]} intensity={1.5} castShadow shadow-mapSize={[1024, 1024]} />
          <pointLight position={[-6, 3, -4]} intensity={10} color="#cfd2ff" />
          <pointLight position={[6, 2, -6]} intensity={8} color="#ffffff" />
          <Suspense fallback={null}>
            <Model url={url} showTextures={showTextures} wireframe={wireframe} />
          </Suspense>
          <ContactShadows position={[0, -0.01, 0]} opacity={0.45} scale={22} blur={2.4} far={9} />
          <Grid
            position={[0, -0.002, 0]}
            args={[40, 40]}
            cellSize={0.6}
            cellThickness={0.6}
            cellColor="#2e2f34"
            sectionSize={3}
            sectionThickness={1}
            sectionColor="#3b3c42"
            fadeDistance={34}
            fadeStrength={1.4}
            infiniteGrid
          />
          <Rig autoRotate={autoRotate} />
        </Canvas>
      ) : (
        <EmptyState />
      )}

      {pendingModel && url && (
        <div className="pointer-events-none absolute left-4 top-4">
          <div className="text-[14px] font-medium text-[var(--text)]">{pendingModel.name}</div>
          <div className="mono text-[11.5px] text-[var(--text-3)]">
            {pendingModel.stats.objects} {t('viewer.meshes')} · {pendingModel.stats.triangles.toLocaleString()} {t('viewer.tris')} ·
            {' '}{pendingModel.stats.size.x}×{pendingModel.stats.size.y}×{pendingModel.stats.size.z}
          </div>
        </div>
      )}

      {url && (
        <div className="absolute right-4 top-4 flex gap-0.5 rounded-lg border border-[var(--line)] bg-[var(--surface)]/90 p-1 backdrop-blur-sm">
          <ToolBtn active={showTextures} onClick={() => setShowTextures((v) => !v)} title={t('viewer.textures')}>
            {showTextures ? <Eye size={15} /> : <EyeOff size={15} />}
          </ToolBtn>
          <ToolBtn active={wireframe} onClick={() => setWireframe((v) => !v)} title={t('viewer.wireframe')}>
            <Box size={15} />
          </ToolBtn>
          <ToolBtn active={autoRotate} onClick={() => setAutoRotate((v) => !v)} title={t('viewer.autorotate')}>
            <RotateCw size={15} />
          </ToolBtn>
        </div>
      )}

      {url && <LoadingOverlay />}

      {pendingModel?.status === 'pending' && <PendingActions busy={busy} onAct={act} />}
    </div>
  );
}

function LoadingOverlay() {
  const { active } = useProgress();
  const { t } = useI18n();
  if (!active) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-[var(--bg)]/50">
      <div className="flex items-center gap-2 text-[13.5px] text-[var(--text-2)]">
        <Loader2 size={16} className="animate-spin" /> {t('viewer.loading')}
      </div>
    </div>
  );
}

function ToolBtn({ children, active, onClick, title }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`flex h-8 w-8 items-center justify-center rounded-md transition ${
        active ? 'bg-[var(--surface-2)] text-[var(--text)]' : 'text-[var(--text-2)] hover:text-[var(--text)]'
      }`}
    >
      {children}
    </button>
  );
}

function PendingActions({ busy, onAct }) {
  const { t } = useI18n();
  const [feedback, setFeedback] = useState('');
  const [askFeedback, setAskFeedback] = useState(false);

  const withFeedback = (action) => {
    onAct(action, feedback ? { feedback } : undefined);
    setFeedback('');
    setAskFeedback(false);
  };

  return (
    <div className="fade-up absolute bottom-4 left-1/2 z-20 w-[min(620px,92%)] -translate-x-1/2">
      <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)]/95 p-3 shadow-2xl backdrop-blur">
        {askFeedback && (
          <input
            autoFocus
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && withFeedback('regenerate')}
            placeholder={t('viewer.feedbackPlaceholder')}
            className="input mb-2.5"
          />
        )}
        <div className="flex items-center justify-between gap-3">
          <span className="text-[12.5px] text-[var(--text-2)]">
            {t('viewer.hint')} <span className="text-[var(--text)]">{t('viewer.hintAssets')}</span>
          </span>
          <div className="flex gap-2">
            <button className="btn btn-danger btn-sm" disabled={!!busy} onClick={() => withFeedback('reject')}>
              <X size={14} /> {t('viewer.reject')}
            </button>
            <button
              className="btn btn-sm"
              disabled={!!busy}
              onClick={() => (askFeedback ? withFeedback('regenerate') : setAskFeedback(true))}
            >
              <RefreshCw size={14} className={busy === 'regenerate' ? 'animate-spin' : ''} />
              {t('viewer.regenerate')}
            </button>
            <button className="btn btn-primary btn-sm" disabled={!!busy} onClick={() => withFeedback('accept')}>
              {busy === 'accept' ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {t('viewer.accept')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  const { t } = useI18n();
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--line)] text-[var(--text-3)]">
        <Box size={26} strokeWidth={1.5} />
      </div>
      <div>
        <div className="text-[17px] font-bold tracking-tight">
          {t('viewer.emptyTitle')} <span className="serif-accent font-normal text-[var(--text-2)]">{t('viewer.emptyAccent')}</span>
        </div>
        <div className="mx-auto mt-1.5 max-w-[400px] text-[13.5px] leading-relaxed text-[var(--text-3)]">
          {t('viewer.emptyDesc')} <span className="text-[var(--text-2)]">{t('viewer.emptyExample')}</span>
          {t('viewer.emptySuffix')}
        </div>
      </div>
    </div>
  );
}

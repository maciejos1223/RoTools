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
    <div className="panel relative h-full min-h-[380px] overflow-hidden">
      {url ? (
        <Canvas shadows dpr={[1, 2]} camera={{ position: [4.5, 3, 4.5], fov: 42 }}>
          <color attach="background" args={['#0e1014']} />
          <fog attach="fog" args={['#0e1014', 20, 46]} />
          <ambientLight intensity={0.55} />
          <directionalLight position={[5, 8, 4]} intensity={1.5} castShadow shadow-mapSize={[1024, 1024]} />
          <pointLight position={[-6, 3, -4]} intensity={10} color="#8b93f8" />
          <pointLight position={[6, 2, -6]} intensity={8} color="#5ac8e8" />
          <Suspense fallback={null}>
            <Model url={url} showTextures={showTextures} wireframe={wireframe} />
          </Suspense>
          <ContactShadows position={[0, -0.01, 0]} opacity={0.5} scale={22} blur={2.4} far={9} />
          <Grid
            position={[0, -0.002, 0]}
            args={[40, 40]}
            cellSize={0.6}
            cellThickness={0.6}
            cellColor="#1d2028"
            sectionSize={3}
            sectionThickness={1}
            sectionColor="#2a2e3a"
            fadeDistance={34}
            fadeStrength={1.4}
            infiniteGrid
          />
          <Rig autoRotate={autoRotate} />
        </Canvas>
      ) : (
        <EmptyState />
      )}

      {/* top-left model info */}
      {pendingModel && url && (
        <div className="pointer-events-none absolute left-3.5 top-3">
          <div className="text-[12.5px] font-medium text-[var(--text)]">{pendingModel.name}</div>
          <div className="mono text-[10.5px] text-[var(--text-3)]">
            {pendingModel.stats.objects} {t('viewer.meshes')} · {pendingModel.stats.triangles.toLocaleString()} {t('viewer.tris')} ·
            {' '}{pendingModel.stats.size.x}×{pendingModel.stats.size.y}×{pendingModel.stats.size.z}
          </div>
        </div>
      )}

      {/* toolbar */}
      <div className="absolute right-3 top-3 flex gap-0.5 rounded-lg border border-[var(--line)] bg-[var(--bg)]/80 p-0.5 backdrop-blur-sm">
        <ToolBtn active={showTextures} onClick={() => setShowTextures((v) => !v)} title={t('viewer.textures')}>
          {showTextures ? <Eye size={14} /> : <EyeOff size={14} />}
        </ToolBtn>
        <ToolBtn active={wireframe} onClick={() => setWireframe((v) => !v)} title={t('viewer.wireframe')}>
          <Box size={14} />
        </ToolBtn>
        <ToolBtn active={autoRotate} onClick={() => setAutoRotate((v) => !v)} title={t('viewer.autorotate')}>
          <RotateCw size={14} />
        </ToolBtn>
      </div>

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
      <div className="flex items-center gap-2 text-[12.5px] text-[var(--text-2)]">
        <Loader2 size={15} className="animate-spin" /> {t('viewer.loading')}
      </div>
    </div>
  );
}

function ToolBtn({ children, active, onClick, title }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`flex h-7 w-7 items-center justify-center rounded-md transition ${
        active ? 'bg-[var(--surface-2)] text-[var(--text)]' : 'text-[var(--text-3)] hover:text-[var(--text-2)]'
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
    <div className="fade-up absolute bottom-3.5 left-1/2 z-20 w-[min(560px,92%)] -translate-x-1/2">
      <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)]/95 p-2.5 shadow-xl backdrop-blur">
        {askFeedback && (
          <input
            autoFocus
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && withFeedback('regenerate')}
            placeholder={t('viewer.feedbackPlaceholder')}
            className="input mb-2"
          />
        )}
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11.5px] text-[var(--text-3)]">
            {t('viewer.hint')} <span className="text-[var(--text-2)]">{t('viewer.hintAssets')}</span>
          </span>
          <div className="flex gap-1.5">
            <button className="btn btn-danger btn-sm" disabled={!!busy} onClick={() => withFeedback('reject')}>
              <X size={13} /> {t('viewer.reject')}
            </button>
            <button
              className="btn btn-sm"
              disabled={!!busy}
              onClick={() => (askFeedback ? withFeedback('regenerate') : setAskFeedback(true))}
            >
              <RefreshCw size={13} className={busy === 'regenerate' ? 'animate-spin' : ''} />
              {t('viewer.regenerate')}
            </button>
            <button className="btn btn-primary btn-sm" disabled={!!busy} onClick={() => withFeedback('accept')}>
              {busy === 'accept' ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
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
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--line)] text-[var(--text-3)]">
        <Box size={20} strokeWidth={1.5} />
      </div>
      <div>
        <div className="text-[13px] font-medium text-[var(--text-2)]">{t('viewer.emptyTitle')}</div>
        <div className="mx-auto mt-1 max-w-[340px] text-[12px] leading-relaxed text-[var(--text-3)]">
          {t('viewer.emptyDesc')} <span className="text-[var(--text-2)]">{t('viewer.emptyExample')}</span>
          {t('viewer.emptySuffix')}
        </div>
      </div>
    </div>
  );
}

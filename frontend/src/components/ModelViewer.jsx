import { Suspense, useEffect, useRef, useState } from 'react';
import { Canvas, useLoader } from '@react-three/fiber';
import { OrbitControls, Grid, ContactShadows, Center, Bounds, useProgress } from '@react-three/drei';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  Box, Eye, EyeOff, RotateCw, Loader2, PackageOpen, Check, X, RefreshCw,
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
      autoRotateSpeed={1.2}
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
    <div className="panel relative h-full min-h-[420px] overflow-hidden">
      {/* toolbar */}
      <div className="absolute right-3 top-3 z-10 flex gap-1.5">
        <ToolbarBtn active={showTextures} onClick={() => setShowTextures((v) => !v)} title={t('viewer.textures')}>
          {showTextures ? <Eye size={15} /> : <EyeOff size={15} />}
        </ToolbarBtn>
        <ToolbarBtn active={wireframe} onClick={() => setWireframe((v) => !v)} title={t('viewer.wireframe')}>
          <Box size={15} />
        </ToolbarBtn>
        <ToolbarBtn active={autoRotate} onClick={() => setAutoRotate((v) => !v)} title={t('viewer.autorotate')}>
          <RotateCw size={15} />
        </ToolbarBtn>
      </div>

      {/* header info */}
      {pendingModel && (
        <div className="absolute left-4 top-3 z-10">
          <div className="text-[13px] font-semibold text-white/90">{pendingModel.name}</div>
          <div className="font-mono text-[10px] text-white/40">
            {pendingModel.stats.objects} {t('viewer.meshes')} · {pendingModel.stats.triangles.toLocaleString()} {t('viewer.tris')} ·
            {' '}{pendingModel.stats.size.x}×{pendingModel.stats.size.y}×{pendingModel.stats.size.z}
          </div>
        </div>
      )}

      {url ? (
        <Canvas shadows dpr={[1, 2]} camera={{ position: [4.5, 3, 4.5], fov: 42 }}>
          <color attach="background" args={['#07080f']} />
          <fog attach="fog" args={['#07080f', 18, 42]} />
          <ambientLight intensity={0.55} />
          <directionalLight
            position={[5, 8, 4]}
            intensity={1.6}
            castShadow
            shadow-mapSize={[1024, 1024]}
          />
          <pointLight position={[-6, 3, -4]} intensity={12} color="#7c5cff" />
          <pointLight position={[6, 2, -6]} intensity={10} color="#22d3ee" />
          <Suspense fallback={null}>
            <Model url={url} showTextures={showTextures} wireframe={wireframe} />
          </Suspense>
          <ContactShadows position={[0, -0.01, 0]} opacity={0.55} scale={22} blur={2.4} far={9} />
          <Grid
            position={[0, -0.002, 0]}
            args={[40, 40]}
            cellSize={0.6}
            cellThickness={0.6}
            cellColor="#1c2030"
            sectionSize={3}
            sectionThickness={1}
            sectionColor="#2a3050"
            fadeDistance={34}
            fadeStrength={1.4}
            infiniteGrid
          />
          <Rig autoRotate={autoRotate} />
        </Canvas>
      ) : (
        <EmptyState />
      )}

      {url && <LoadingOverlay />}

      {/* pending actions overlay */}
      {pendingModel?.status === 'pending' && (
        <PendingActions busy={busy} onAct={act} />
      )}
    </div>
  );
}

function LoadingOverlay() {
  const { active } = useProgress();
  const { t } = useI18n();
  if (!active) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-[#07080f]/50">
      <div className="flex items-center gap-2 text-sm text-white/70">
        <Loader2 size={16} className="animate-spin" /> {t('viewer.loading')}
      </div>
    </div>
  );
}

function ToolbarBtn({ children, active, onClick, title }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-all ${
        active
          ? 'border-violet-400/40 bg-violet-500/25 text-violet-200'
          : 'border-white/10 bg-white/[0.04] text-white/50 hover:bg-white/10 hover:text-white/80'
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
    <div className="fade-up absolute bottom-4 left-1/2 z-20 w-[min(560px,92%)] -translate-x-1/2">
      <div className="panel glow-accent p-3">
        {askFeedback && (
          <input
            autoFocus
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && withFeedback('regenerate')}
            placeholder={t('viewer.feedbackPlaceholder')}
            className="mb-2 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-violet-400/50"
          />
        )}
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-white/50">
            {t('viewer.hint')} <b className="text-white/80">{t('viewer.hintAssets')}</b>.
          </span>
          <div className="flex gap-2">
            <button className="btn btn-bad" disabled={!!busy} onClick={() => withFeedback('reject')}>
              <X size={14} /> {t('viewer.reject')}
            </button>
            <button
              className="btn"
              disabled={!!busy}
              onClick={() => (askFeedback ? withFeedback('regenerate') : setAskFeedback(true))}
            >
              <RefreshCw size={14} className={busy === 'regenerate' ? 'animate-spin' : ''} />
              {t('viewer.regenerate')}
            </button>
            <button className="btn btn-good" disabled={!!busy} onClick={() => withFeedback('accept')}>
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
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-violet-400/20 bg-violet-500/10 text-violet-300">
        <PackageOpen size={30} strokeWidth={1.5} />
      </div>
      <div>
        <div className="text-sm font-semibold text-white/80">{t('viewer.emptyTitle')}</div>
        <div className="mt-1 max-w-[320px] text-xs leading-relaxed text-white/40">
          {t('viewer.emptyDesc')} <span className="text-violet-300/90">{t('viewer.emptyExample')}</span>
          {t('viewer.emptySuffix')}
        </div>
      </div>
    </div>
  );
}

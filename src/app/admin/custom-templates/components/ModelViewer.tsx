'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Mesh, Material, Object3D, PerspectiveCamera, WebGLRenderer } from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/** `#rrggbb` that is `t` of the way from `a` to `b`. */
function blendHex(a: string, b: string, t: number) {
  const channel = (hex: string, at: number) => parseInt(hex.slice(1 + at * 2, 3 + at * 2), 16);
  const mixed = [0, 1, 2].map((k) => Math.round(channel(a, k) * (1 - t) + channel(b, k) * t));
  return '#' + mixed.map((v) => v.toString(16).padStart(2, '0')).join('');
}

/** Highlight colours; the legend in the model section shows the same two. */
export const FRONT_TINT = '#e4572e';
export const BACK_TINT = '#0f766e';

interface Props {
  bytes: ArrayBuffer;
  frontMesh: string;
  backMesh: string;
  bodyMesh: string;
  /** `#rrggbb` of the colour option being previewed, or '' for the file's own colour. */
  colorHex: string;
  /** The file could not be shown; the page keeps working without the preview. */
  onFailed: (message: string) => void;
}

type Tintable = Material & { color?: { set: (v: string) => void; getHexString: () => string }; emissive?: { set: (v: string) => void; getHexString: () => string }; emissiveIntensity?: number };
interface Part {
  mesh: Mesh;
  /** Name of the glTF mesh the object came from (not the node's name). */
  name: string;
  baseColors: string[];
  /** The file's own emissive colour, put back whenever the tint changes. */
  baseEmissive: string[];
}

interface Live {
  parts: Part[];
  render: () => void;
  reset: () => void;
  dispose: () => void;
}

/**
 * A look at the uploaded GLB, to pick meshes and see the colour. It only reads
 * the bytes it is given; nothing it draws is saved. A bad file reports through
 * `onFailed` and leaves the form usable.
 */
export default function ModelViewer({ bytes, frontMesh, backMesh, bodyMesh, colorHex, onFailed }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const live = useRef<Live | null>(null);
  const [ready, setReady] = useState(false);
  const failed = useRef(onFailed);
  useEffect(() => {
    failed.current = onFailed;
  });

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let cancelled = false;
    let teardown: (() => void) | null = null;
    setReady(false);

    (async () => {
      let renderer: WebGLRenderer;
      const THREE = await import('three');
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      } catch {
        if (!cancelled) failed.current('เบราว์เซอร์นี้แสดงโมเดล 3D ไม่ได้ (ไม่รองรับ WebGL) — ยังอัปโหลดและเลือก mesh จากรายการได้');
        return;
      }
      const [{ GLTFLoader }, { OrbitControls }, { RoomEnvironment }] = await Promise.all([
        import('three/examples/jsm/loaders/GLTFLoader.js'),
        import('three/examples/jsm/controls/OrbitControls.js'),
        import('three/examples/jsm/environments/RoomEnvironment.js'),
      ]);
      if (cancelled) {
        renderer.dispose();
        renderer.forceContextLoss();
        return;
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      el.appendChild(renderer.domElement);
      renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none';

      const scene = new THREE.Scene();
      // A plain studio environment so metal (steel bands) reflects something
      // instead of rendering black.
      const pmrem = new THREE.PMREMGenerator(renderer);
      const room = new RoomEnvironment();
      const environmentTarget = pmrem.fromScene(room, 0.04);
      room.dispose();
      scene.environment = environmentTarget.texture;
      // Kept low: a white print area at full strength clips to pure white and
      // hides any highlight laid over it.
      scene.environmentIntensity = 0.55;
      scene.add(new THREE.HemisphereLight('#ffffff', '#8a8f99', 0.5));
      const sun = new THREE.DirectionalLight('#ffffff', 0.8);
      sun.position.set(2, 3, 4);
      scene.add(sun);
      const camera: PerspectiveCamera = new THREE.PerspectiveCamera(35, 1, 0.01, 1000);
      const controls: OrbitControls = new OrbitControls(camera, renderer.domElement);
      const render = () => renderer.render(scene, camera);
      controls.addEventListener('change', render);

      const resize = () => {
        const { clientWidth: w, clientHeight: h } = el;
        if (!w || !h) return;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        render();
      };
      const observer = new ResizeObserver(resize);
      observer.observe(el);

      let framed: { x: number; y: number; z: number; d: number } | null = null;
      const reset = () => {
        if (!framed) return;
        camera.position.set(framed.x, framed.y + framed.d * 0.15, framed.z + framed.d);
        controls.target.set(framed.x, framed.y, framed.z);
        controls.update();
        render();
      };

      const disposeScene = () => {
        scene.traverse((o: Object3D) => {
          const m = o as Mesh;
          if (!m.isMesh) return;
          m.geometry.dispose();
          for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
            for (const v of Object.values(mat)) {
              if (v && typeof v === 'object' && 'isTexture' in v) (v as { dispose: () => void }).dispose();
            }
            mat.dispose();
          }
        });
      };

      teardown = () => {
        observer.disconnect();
        controls.dispose();
        disposeScene();
        environmentTarget.dispose();
        pmrem.dispose();
        renderer.dispose();
        renderer.forceContextLoss();
        renderer.domElement.remove();
        live.current = null;
      };

      try {
        const gltf = await new GLTFLoader().parseAsync(bytes.slice(0), '');
        if (cancelled) return;
        const json = (gltf.parser as unknown as { json: { meshes?: { name?: string }[] } }).json;
        const associations = gltf.parser.associations;
        const parts: Part[] = [];
        gltf.scene.traverse((o: Object3D) => {
          const mesh = o as Mesh;
          if (!mesh.isMesh) return;
          const index = associations.get(mesh)?.meshes;
          const name = index === undefined ? '' : (json.meshes?.[index]?.name ?? '');
          // Each part owns its materials, so tinting one never leaks into another.
          const mats = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map((m) => m.clone() as Tintable);
          mesh.material = Array.isArray(mesh.material) ? mats : mats[0];
          parts.push({
            mesh,
            name,
            baseColors: mats.map((m) => (m.color ? m.color.getHexString() : '')),
            baseEmissive: mats.map((m) => (m.emissive ? m.emissive.getHexString() : '')),
          });
        });
        scene.add(gltf.scene);
        const box = new THREE.Box3().setFromObject(gltf.scene);
        const centre = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const radius = Math.max(size.x, size.y, size.z, 0.001) / 2;
        const d = radius / Math.tan((camera.fov * Math.PI) / 360) * 1.25;
        framed = { x: centre.x, y: centre.y, z: centre.z, d };
        camera.near = d / 100;
        camera.far = d * 100;
        controls.maxDistance = d * 4;
        controls.minDistance = d * 0.25;
        live.current = { parts, render, reset, dispose: teardown! };
        resize();
        reset();
        setReady(true);
      } catch {
        if (!cancelled) failed.current('อ่านไฟล์โมเดลไม่ได้ จึงแสดงตัวอย่างไม่ได้ — ลองอัปโหลดไฟล์ใหม่');
      }
    })().catch(() => {
      if (!cancelled) failed.current('แสดงตัวอย่างโมเดลไม่สำเร็จ');
    });

    return () => {
      cancelled = true;
      teardown?.();
    };
  }, [bytes]);

  // Tints follow the form without reloading the file.
  useEffect(() => {
    const current = live.current;
    if (!ready || !current) return;
    for (const part of current.parts) {
      const mats = (Array.isArray(part.mesh.material) ? part.mesh.material : [part.mesh.material]) as Tintable[];
      mats.forEach((m, i) => {
        if (m.color && part.baseColors[i]) m.color.set('#' + part.baseColors[i]);
        if (m.emissive && part.baseEmissive[i]) m.emissive.set('#' + part.baseEmissive[i]);
        if (part.name && part.name === bodyMesh && colorHex && m.color) m.color.set(colorHex);
        const tint = part.name && part.name === frontMesh ? FRONT_TINT : part.name && part.name === backMesh ? BACK_TINT : '';
        if (tint && m.color) {
          // Mix the tint into the surface colour; an emissive glow on white
          // clips to white and shows nothing.
          m.color.set(blendHex(part.baseColors[i] ? '#' + part.baseColors[i] : '#ffffff', tint, 0.6));
        }
      });
    }
    current.render();
  }, [ready, frontMesh, backMesh, bodyMesh, colorHex]);

  const reset = useCallback(() => live.current?.reset(), []);

  return (
    <div className="relative">
      <div
        ref={host}
        role="img"
        aria-label="ตัวอย่างโมเดล 3D ที่อัปโหลด ลากเพื่อหมุน เลื่อนล้อเมาส์เพื่อซูม"
        className="h-72 w-full overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] sm:h-80"
      />
      {!ready && (
        <p className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-[var(--ink-muted)]" role="status">
          กำลังเตรียมตัวอย่างโมเดล…
        </p>
      )}
      {ready && (
        <button type="button" className="ka-btn ka-btn--sm absolute right-2 top-2" onClick={reset}>
          รีเซ็ตมุมมอง
        </button>
      )}
    </div>
  );
}

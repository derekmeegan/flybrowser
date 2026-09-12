"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Replay, replayState, TIMING } from "@/lib/replay";

/* ANIMATION STORYBOARD
 * Mount     load exported anatomical meshes and recorded browser frames
 * Each RAF  advance the shared replay clock; interpolate authored body poses
 *  4200ms   first recorded click / browser state change
 *  8400ms   second recorded click / browser state change
 * 12600ms   final recorded click / terminal result
 * 18000ms   loop, including the authored fly motion
 */
const CAMERA = {
  position: [1.02, 0.5, 0.97],
  target: [0.25, 0.03, 0.02],
  fov: 42,
  minDistance: 0.55,
  maxDistance: 2.3,
  damping: 0.075,
};
const LIGHT = {
  ambient: 1.6,
  key: 2.4,
  fill: 0.8,
  shadowSize: 2048,
  shadowBias: -0.0001,
};
type Geom = {
  id: number;
  name: string;
  type: number;
  mesh: number;
  body: number;
  position: number[];
  quaternion: number[];
  size: number[];
  rgba: number[];
};
type SceneData = {
  meshes: Record<
    string,
    {
      vertexOffset: number;
      vertexCount: number;
      indexOffset: number;
      indexCount: number;
    }
  >;
  geoms: Geom[];
  bodyCount: number;
  motionFrames: number;
  motionFps: number;
};
export type SceneHandle = {
  time: number;
  playing: boolean;
  speed: number;
  replay: Replay | null;
  resetCamera: number;
};
export default function FlyScene({
  clock,
  onReady,
}: {
  clock: React.RefObject<SceneHandle>;
  onReady: () => void;
}) {
  const mount = useRef<HTMLDivElement>(null);
  const readyRef = useRef(onReady);
  const [error, setError] = useState("");
  useEffect(() => {
    readyRef.current = onReady;
  }, [onReady]);
  useEffect(() => {
    const host = mount.current;
    if (!host) return;
    let gone = false,
      raf = 0,
      renderer: THREE.WebGLRenderer | undefined;
    let cleanup = () => {};
    const abort = new AbortController();
    async function setup() {
      const load = async (path: string) => {
        const r = await fetch("/assets/" + path, { signal: abort.signal });
        if (!r.ok) throw new Error("Could not load " + path);
        return r;
      };
      const [description, geometry, motion] = await Promise.all([
        load("scene.json").then((r) => r.json() as Promise<SceneData>),
        load("geometry.bin").then((r) => r.arrayBuffer()),
        load("body-motion.bin").then((r) => r.arrayBuffer()),
      ]);
      if (gone) return;
      const state = description,
        tracks = new Float32Array(motion);
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(0xf2ede9);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFShadowMap;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      renderer.domElement.setAttribute(
        "aria-label",
        "Interactive 3D fly workstation. Drag to orbit; scroll to zoom.",
      );
      renderer.domElement.setAttribute("role", "img");
      host!.appendChild(renderer.domElement);
      const world = new THREE.Scene();
      world.background = new THREE.Color(0xf2ede9);
      const root = new THREE.Group();
      root.rotation.x = -Math.PI / 2;
      world.add(root);
      const camera = new THREE.PerspectiveCamera(CAMERA.fov, 1, 0.01, 30);
      camera.position.fromArray(CAMERA.position);
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.target.fromArray(CAMERA.target);
      controls.enableDamping = true;
      controls.dampingFactor = CAMERA.damping;
      controls.minDistance = CAMERA.minDistance;
      controls.maxDistance = CAMERA.maxDistance;
      controls.maxPolarAngle = Math.PI * 0.49;
      controls.enablePan = false;
      controls.update();
      controls.saveState();
      world.add(new THREE.HemisphereLight(0xffffff, 0xb7a99c, LIGHT.ambient));
      const key = new THREE.DirectionalLight(0xffffff, LIGHT.key);
      key.position.set(-0.7, 1.6, 1.0);
      key.castShadow = true;
      key.shadow.mapSize.set(LIGHT.shadowSize, LIGHT.shadowSize);
      key.shadow.camera.left = -1.1;
      key.shadow.camera.right = 1.1;
      key.shadow.camera.top = 1.1;
      key.shadow.camera.bottom = -1.1;
      key.shadow.camera.near = 0.01;
      key.shadow.camera.far = 5;
      key.shadow.bias = LIGHT.shadowBias;
      key.shadow.normalBias = 0.001;
      world.add(key);
      const fill = new THREE.DirectionalLight(0xffeee2, LIGHT.fill);
      fill.position.set(1, 0.7, -0.5);
      world.add(fill);
      const groups = Array.from(
        { length: state.bodyCount },
        () => new THREE.Group(),
      );
      groups.forEach((g) => root.add(g));
      const geometryCache = new Map<number, THREE.BufferGeometry>();
      const materials: THREE.Material[] = [];
      const screenCanvas = document.createElement("canvas");
      screenCanvas.width = 1000;
      screenCanvas.height = 680;
      const ctx = screenCanvas.getContext("2d")!;
      const screenTexture = new THREE.CanvasTexture(screenCanvas);
      screenTexture.colorSpace = THREE.SRGBColorSpace;
      screenTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      for (const g of state.geoms) {
        let shape: THREE.BufferGeometry;
        if (g.name === "screen") {
          shape = new THREE.PlaneGeometry(0.5, 0.34);
          shape.rotateX(Math.PI / 2);
          // The screen's exported geom transform includes mesh recentering;
          // its original screen-plane has no offset in this scene.
        } else if (g.type === 7) {
          if (!geometryCache.has(g.mesh)) {
            const spec = state.meshes[String(g.mesh)],
              buffer = new THREE.BufferGeometry();
            buffer.setAttribute(
              "position",
              new THREE.BufferAttribute(
                new Float32Array(geometry, spec.vertexOffset, spec.vertexCount),
                3,
              ),
            );
            buffer.setIndex(
              new THREE.BufferAttribute(
                new Uint32Array(geometry, spec.indexOffset, spec.indexCount),
                1,
              ),
            );
            buffer.computeVertexNormals();
            geometryCache.set(g.mesh, buffer);
          }
          shape = geometryCache.get(g.mesh)!;
        } else if (g.type === 6)
          shape = new THREE.BoxGeometry(
            g.size[0] * 2,
            g.size[1] * 2,
            g.size[2] * 2,
          );
        else if (g.type === 5) {
          shape = new THREE.CylinderGeometry(
            g.size[0],
            g.size[0],
            g.size[1] * 2,
            24,
          );
          shape.rotateX(Math.PI / 2);
        } else if (g.type === 3) {
          shape = new THREE.CapsuleGeometry(g.size[0], g.size[1] * 2, 4, 12);
          shape.rotateX(Math.PI / 2);
        } else if (g.type === 4) {
          shape = new THREE.SphereGeometry(1, 20, 12);
          shape.scale(g.size[0], g.size[1], g.size[2]);
        } else if (g.type === 2)
          shape = new THREE.SphereGeometry(g.size[0], 16, 12);
        else if (g.type === 0) shape = new THREE.PlaneGeometry(12, 12);
        else continue;
        const color = new THREE.Color().setRGB(
          g.rgba[0],
          g.rgba[1],
          g.rgba[2],
          THREE.SRGBColorSpace,
        );
        const material =
          g.name === "screen"
            ? new THREE.MeshBasicMaterial({
                map: screenTexture,
                side: THREE.DoubleSide,
                toneMapped: false,
              })
            : new THREE.MeshStandardMaterial({
                color,
                roughness: 0.84,
                metalness: 0,
                flatShading: g.type === 7,
                transparent: g.rgba[3] < 1,
                opacity: g.rgba[3],
                side: THREE.DoubleSide,
              });
        materials.push(material);
        const object = new THREE.Mesh(shape, material);
        object.position.fromArray(g.position);
        object.quaternion.set(
          g.quaternion[1],
          g.quaternion[2],
          g.quaternion[3],
          g.quaternion[0],
        );
        object.castShadow = g.name !== "screen" && g.type !== 0;
        object.receiveShadow = g.name !== "screen";
        groups[g.body].add(object);
        if (g.name === "screen") {
          // Use the exact world-space monitor plane, avoiding MuJoCo's
          // internal principal-axis normalization of the thin screen mesh.
          object.position.set(0.205, 0.105, 0.2);
          object.quaternion.identity();
        }
      }
      const images = new Map<string, HTMLImageElement>();
      const imageFor = (path: string) => {
        if (!images.has(path)) {
          const im = new window.Image();
          im.src = path;
          images.set(path, im);
        }
        return images.get(path)!;
      };
      const allReplays = await load("replays.json").then(
        (r) => r.json() as Promise<Replay[]>,
      );
      await Promise.all(
        allReplays.flatMap((r) =>
          r.frames.map(
            (f) =>
              new Promise<void>((resolve) => {
                const image = imageFor(f.file);
                if (image.complete) resolve();
                else {
                  image.onload = () => resolve();
                  image.onerror = () => resolve();
                }
              }),
          ),
        ),
      );
      if (gone) return;
      const resize = new ResizeObserver(() => {
        if (!renderer || !host) return;
        const { width, height } = host.getBoundingClientRect();
        if (width <= 0 || height <= 0) return;
        renderer.setSize(width, height);
        camera.aspect = width / height;
        // Preserve the horizontal framing when the scene becomes portrait.
        camera.fov = THREE.MathUtils.radToDeg(
          2 *
            Math.atan(
              Math.tan(THREE.MathUtils.degToRad(CAMERA.fov / 2)) /
                Math.min(1, camera.aspect),
            ),
        );
        camera.updateProjectionMatrix();
      });
      resize.observe(host!);
      const q0 = new THREE.Quaternion(),
        q1 = new THREE.Quaternion();
      let previous = performance.now(),
        lastReset = clock.current.resetCamera;
      const render = (now: number) => {
        const elapsed = Math.min(100, now - previous);
        previous = now;
        if (clock.current.playing && !document.hidden)
          clock.current.time =
            (clock.current.time + elapsed * clock.current.speed) % TIMING.loop;
        if (clock.current.resetCamera !== lastReset) {
          lastReset = clock.current.resetCamera;
          controls.reset();
        }
        const sample = (clock.current.time / 1000) * state.motionFps,
          index = Math.min(state.motionFrames - 2, Math.floor(sample)),
          mix = sample - index;
        groups.forEach((group, i) => {
          const a = (index * state.bodyCount + i) * 7,
            b = ((index + 1) * state.bodyCount + i) * 7;
          group.position.set(
            THREE.MathUtils.lerp(tracks[a], tracks[b], mix),
            THREE.MathUtils.lerp(tracks[a + 1], tracks[b + 1], mix),
            THREE.MathUtils.lerp(tracks[a + 2], tracks[b + 2], mix),
          );
          q0.set(tracks[a + 4], tracks[a + 5], tracks[a + 6], tracks[a + 3]);
          q1.set(tracks[b + 4], tracks[b + 5], tracks[b + 6], tracks[b + 3]);
          group.quaternion.copy(q0.slerp(q1, mix));
        });
        if (clock.current.replay) {
          const current = replayState(clock.current.replay, clock.current.time),
            im = imageFor(current.frame);
          if (im.complete && im.naturalWidth) {
            ctx.drawImage(im, 0, 0, 1000, 680);
            if (!current.finished) {
              const { x, y } = current.cursor;
              ctx.save();
              ctx.translate(x, y);
              ctx.fillStyle = "#100d0d";
              ctx.strokeStyle = "white";
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.moveTo(0, 0);
              ctx.lineTo(2, 28);
              ctx.lineTo(10, 20);
              ctx.lineTo(17, 32);
              ctx.lineTo(23, 28);
              ctx.lineTo(16, 17);
              ctx.lineTo(27, 15);
              ctx.closePath();
              ctx.fill();
              ctx.stroke();
              ctx.restore();
            }
            if (current.pulse > 0) {
              ctx.strokeStyle = "#f03603";
              ctx.lineWidth = 3;
              ctx.beginPath();
              ctx.arc(
                current.cursor.x,
                current.cursor.y,
                14 + (1 - current.pulse) * 24,
                0,
                Math.PI * 2,
              );
              ctx.stroke();
            }
            screenTexture.needsUpdate = true;
          }
        }
        controls.update();
        renderer!.render(world, camera);
        raf = requestAnimationFrame(render);
      };
      cleanup = () => {
        resize.disconnect();
        controls.dispose();
        world.traverse((obj) => {
          if (obj instanceof THREE.Mesh) obj.geometry.dispose();
        });
        materials.forEach((m) => m.dispose());
        screenTexture.dispose();
      };
      readyRef.current();
      raf = requestAnimationFrame(render);
    }
    setup().catch((e) => {
      if (!gone)
        setError(
          e instanceof Error ? e.message : "The 3D scene could not load.",
        );
    });
    return () => {
      gone = true;
      abort.abort();
      cancelAnimationFrame(raf);
      cleanup();
      renderer?.dispose();
      renderer?.domElement.remove();
    };
  }, [clock]);
  return (
    <div
      ref={mount}
      className="three-stage"
      style={error ? { zIndex: 5 } : undefined}
    >
      {error && (
        <div className="scene-error" role="alert">
          <b>3D view unavailable</b>
          <p>{error}</p>
          <a href="/assets/fly-browser-demo.mp4">Watch the recorded video ↗</a>
        </div>
      )}
    </div>
  );
}

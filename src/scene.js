import {
  WebGLRenderer, Scene, PerspectiveCamera, Color, FogExp2, BufferGeometry, BufferAttribute,
  Float32BufferAttribute, ShaderMaterial, Points, AdditiveBlending, CatmullRomCurve3, Vector3,
  Vector4, Group, MathUtils,
} from 'three';
import { createKit, buildDiorama } from './dioramas.js';
import { createShooter } from './shooter.js';

const MAX_DPR = 1.75;
const RETRO_DPR = 0.22; // konami easter egg: chunky 8-bit pixels
// sparser terrain on phones and low-core machines: half the points, hardly visible at that size
const GRID_STEP = innerWidth < 700 || (navigator.hardwareConcurrency || 8) <= 4 ? 1.7 : 1.15;
const GRID_HALF_WIDTH = 120;
const GRID_Z = [45, -370];
const PATH_SPAN = 0.93;
const STATION_LEAD = 0.08; // dioramas sit a little ahead of the camera so they are in frame while their copy is
const CULL_DISTANCE = 85; // only nearby dioramas render, so later chapters never clutter the hero // camera never reaches the curve end so it always has something to look at
const INK = new Color('#0c0d10');

const PATH = new CatmullRomCurve3([
  [0, 10, 32], [5, 8, -20], [-7, 10, -70], [8, 7, -120],
  [-5, 11, -170], [6, 8, -220], [0, 13, -270], [0, 7, -330],
].map(([x, y, z]) => new Vector3(x, y, z)));

const terrainVertex = /* glsl */ `
  uniform float uTime;
  uniform float uAudio;
  uniform float uDpr;
  uniform vec4 uMix;
  uniform vec3 uCam;
  uniform vec3 uAccent;
  uniform vec3 uImpact;
  uniform float uImpactAge;
  varying vec3 vColor;
  varying float vAlpha;

  float dunes(vec2 p, float t) { return sin(p.x * .08 + t * .4) * cos(p.y * .06 + t * .3) * 2.4 + sin(p.y * .17 - t * .6) * .6; }
  float blocks(vec2 p, float t) { float h = sin(p.x * .06 + t * .2) * cos(p.y * .05 - t * .25) * 4.; return floor(h * 1.2) / 1.2; }
  float spikes(vec2 p, float t) { return sin(p.x * .7 + t) * sin(p.y * .55 - t * 1.3) * 1.3 + dunes(p, t) * .5; }
  float rings(vec2 p, float t) { return sin(length(p - uCam.xz) * .35 - t * 2.) * 1.9; }

  void main() {
    vec3 p = position;
    float t = uTime;
    float h = dot(uMix, vec4(dunes(p.xz, t), blocks(p.xz, t), spikes(p.xz, t), rings(p.xz, t)));
    float d = length(p.xz - uCam.xz);
    h += sin(d * .55 - t * 9.) * uAudio * 3.2 * exp(-d * .012);
    float id = length(p.xz - uImpact.xz); // shot shockwave
    h += sin(id * .7 - uImpactAge * 16.) * 5. * exp(-uImpactAge * 1.8) * exp(-id * .06) * step(uImpactAge, 4.);
    p.y += h;

    vec4 mv = modelViewMatrix * vec4(p, 1.);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = clamp(2.1 * (70. / -mv.z), 1., 7.) * uDpr;

    float lift = smoothstep(-1.5, 3.5, h);
    vColor = mix(vec3(.55, .53, .5), uAccent, lift);
    vAlpha = (.2 + lift * .6) * smoothstep(190., 25., -mv.z); // kept low so copy over the terrain stays readable
  }
`;

const terrainFragment = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord - .5;
    float r = dot(c, c);
    if (r > .25) discard;
    gl_FragColor = vec4(vColor, vAlpha * smoothstep(.25, .05, r));
  }
`;

function buildTerrain(uniforms) {
  const cols = Math.floor((GRID_HALF_WIDTH * 2) / GRID_STEP);
  const rows = Math.floor((GRID_Z[0] - GRID_Z[1]) / GRID_STEP);
  const pos = new Float32Array(cols * rows * 3);
  let i = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      pos[i++] = -GRID_HALF_WIDTH + c * GRID_STEP;
      pos[i++] = 0;
      pos[i++] = GRID_Z[0] - r * GRID_STEP;
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pos, 3));
  const mat = new ShaderMaterial({
    uniforms, vertexShader: terrainVertex, fragmentShader: terrainFragment,
    transparent: true, depthWrite: false, blending: AdditiveBlending,
  });
  return new Points(geo, mat);
}

function buildDust() {
  const n = 1400;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    pos[i * 3] = MathUtils.randFloatSpread(140);
    pos[i * 3 + 1] = MathUtils.randFloat(2, 45);
    pos[i * 3 + 2] = MathUtils.randFloat(GRID_Z[1], GRID_Z[0]);
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  const mat = new ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: `uniform float uTime; varying float vA;
      void main(){ vec3 p = position; p.y += sin(uTime * .3 + p.x) * .8;
        vec4 mv = modelViewMatrix * vec4(p,1.); gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(40. / -mv.z, 1., 3.); vA = smoothstep(160., 10., -mv.z) * .5; }`,
    fragmentShader: `varying float vA; void main(){ gl_FragColor = vec4(.93,.9,.85,vA); }`,
    transparent: true, depthWrite: false, blending: AdditiveBlending,
  });
  return new Points(geo, mat);
}

export function createScene(canvas, { onContextLost } = {}) {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setClearColor(INK, 1);

  const scene = new Scene();
  scene.fog = new FogExp2(INK, 0.012);
  const camera = new PerspectiveCamera(58, 1, 0.1, 400);

  const uniforms = {
    uTime: { value: 0 },
    uAudio: { value: 0 },
    uDpr: { value: 1 },
    uMix: { value: new Vector4(1, 0, 0, 0) },
    uCam: { value: new Vector3() },
    uAccent: { value: new Color('#ff5b1f') },
    uImpact: { value: new Vector3(0, 0, 9999) },
    uImpactAge: { value: 99 },
  };
  const terrain = buildTerrain(uniforms);
  const dust = buildDust();
  const stations = new Group();
  const kit = createKit();
  const dioramas = [];
  const dctx = { t: 0, audio: 0, step: -1 };
  scene.add(terrain, dust, stations);
  const shooter = createShooter({ scene, camera, stations, uniforms, kit });

  // targets that the DOM writes, and smoothed values the loop reads
  const target = { progress: 0, accent: new Color('#ff5b1f'), mix: new Vector4(1, 0, 0, 0), audio: 0, px: 0, py: 0 };
  const now = { progress: 0, px: 0, py: 0 };
  let retro = false;
  const camPos = new Vector3();
  const lookAt = new Vector3();

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const dpr = retro ? RETRO_DPR : Math.min(window.devicePixelRatio, MAX_DPR);
    renderer.setPixelRatio(dpr);
    uniforms.uDpr.value = retro ? 0.5 : dpr; // keep points visible when the buffer is tiny
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w < 700 ? 72 : 58;
    camera.updateProjectionMatrix();
  }

  let raf = 0;
  let last = performance.now();
  function frame(ts) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(Math.max((ts - last) / 1000, 0), 0.05); // first rAF ts can precede performance.now()
    last = ts;
    const k = 1 - Math.exp(-dt * 4); // frame-rate independent easing

    uniforms.uTime.value += dt;
    dust.material.uniforms.uTime.value = uniforms.uTime.value;
    now.progress += (target.progress - now.progress) * k;
    now.px += (target.px - now.px) * k;
    now.py += (target.py - now.py) * k;
    uniforms.uAccent.value.lerp(target.accent, k * 0.8);
    uniforms.uMix.value.lerp(target.mix, k * 0.6);
    uniforms.uAudio.value += (target.audio - uniforms.uAudio.value) * (1 - Math.exp(-dt * 12));

    const t = MathUtils.clamp(now.progress * PATH_SPAN, 0, 1);
    PATH.getPointAt(t, camPos);
    PATH.getPointAt(Math.min(t + 0.05, 1), lookAt);
    camPos.x += now.px * 2.5;
    camPos.y += now.py * 1.5;
    lookAt.y -= 3;
    camera.position.copy(camPos);
    camera.lookAt(lookAt);
    uniforms.uCam.value.copy(camPos);

    dctx.t = uniforms.uTime.value;
    dctx.audio = uniforms.uAudio.value;
    for (const d of dioramas) {
      d.group.visible = Math.abs(d.group.position.z - camPos.z) < CULL_DISTANCE;
      if (d.group.visible) d.update(dctx);
    }

    shooter.update(dt);
    renderer.render(scene, camera);
  }

  function start() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } }
  function stop() { cancelAnimationFrame(raf); raf = 0; }
  const onVisibility = () => (document.hidden ? stop() : start());
  const onLost = (e) => { e.preventDefault(); stop(); onContextLost?.(); };

  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', onVisibility);
  canvas.addEventListener('webglcontextlost', onLost);
  resize();
  start();

  return {
    // ScrollTrigger can report NaN before layout settles (e.g. loading with #hash); the curve would throw
    setProgress(p) { if (Number.isFinite(p)) target.progress = MathUtils.clamp(p, 0, 1); },
    setAccent(hex) { target.accent.set(hex); },
    setShape(i) { target.mix.set(+(i === 0), +(i === 1), +(i === 2), +(i === 3)); },
    setAudio(level) { target.audio = level; },
    setPointer(x, y) { target.px = x; target.py = y; },
    setStep(i) { dctx.step = i; },
    /** @param {number} x NDC  @param {number} y NDC */
    shoot: (x, y) => shooter.shoot(x, y),
    setRetro(on) { retro = on; resize(); },
    /** Builds dioramas once, then only repositions them when the page layout changes. */
    placeStations(list) {
      const p = new Vector3();
      list.forEach(({ progress, kind, color, side }, i) => {
        if (!dioramas[i]) {
          dioramas[i] = buildDiorama(kind, color, kit);
          stations.add(dioramas[i].group);
        }
        const d = dioramas[i];
        // narrow (portrait) views have a small horizontal FOV: pull dioramas toward the path and further ahead
        const narrow = Math.min(1, Math.max(0.35, camera.aspect / 1.6));
        PATH.getPointAt(MathUtils.clamp(progress * PATH_SPAN + STATION_LEAD + (1 - narrow) * 0.05, 0, 1), p);
        d.group.position.set(p.x + side * d.offset * narrow, 0.5, p.z);
        d.group.rotation.y = side < 0 ? Math.PI : 0; // dioramas are authored for the right-hand side; mirror for the left
      });
    },
    destroy() {
      stop();
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
      canvas.removeEventListener('webglcontextlost', onLost);
      kit.dispose();
      [terrain, dust].forEach((o) => { o.geometry.dispose(); o.material.dispose(); });
      renderer.dispose();
    },
  };
}

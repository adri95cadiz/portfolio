// Click-to-shoot: a tracer from the bottom-right of the view to whatever the probe points at.
// Diorama parts shatter into wireframe shards and rebuild a few seconds later; big parts only spark;
// the terrain takes a shockwave (uImpact / uImpactAge in the terrain shader).
import {
  Raycaster, Vector2, Vector3, Plane, Box3, BufferGeometry, Float32BufferAttribute, Line, LineBasicMaterial,
  BoxGeometry, EdgesGeometry, LineSegments, Color,
} from 'three';

const SHARDS = 160;
const SHARDS_PER_HIT = 22;
const ARMOR_SIZE = 14; // parts bigger than this (roads, belts, frames) don't break, they spark
const REBUILD_S = 3.5;
const POP_S = 0.45;
const TRACER_S = 0.09;
const GRAVITY = 26;
const NEAR_CAMERA = 9; // shards closer than this would fill the screen and cover the copy
const MIN_RANGE = 10; // ignore targets practically on top of the camera
const MISS_RANGE = 140; // a shot at the sky still flies off into the distance

export function createShooter({ scene, camera, stations, uniforms, kit }) {
  const ray = new Raycaster();
  ray.params.Line.threshold = 0.2;
  ray.near = MIN_RANGE;
  const ndc = new Vector2();
  const ground = new Plane(new Vector3(0, 1, 0), -1);
  const tmp = new Vector3();
  const box = new Box3();
  const size = new Vector3();

  const tracerGeo = kit.own(new BufferGeometry());
  tracerGeo.setAttribute('position', new Float32BufferAttribute(new Float32Array(6), 3));
  const tracerMat = kit.own(new LineBasicMaterial({ color: 0xffffff, transparent: true }));
  const tracer = new Line(tracerGeo, tracerMat);
  tracer.frustumCulled = false;
  tracer.visible = false;
  scene.add(tracer);
  let tracerLife = 0;

  const shardGeo = kit.own(new EdgesGeometry(kit.own(new BoxGeometry(0.55, 0.55, 0.55))));
  const shards = Array.from({ length: SHARDS }, () => {
    const s = new LineSegments(shardGeo, kit.line('#ece6da'));
    s.visible = false;
    s.userData = { v: new Vector3(), spin: new Vector3(), life: 0, max: 1 };
    scene.add(s);
    return s;
  });
  let next = 0;

  const broken = []; // { obj, t, scale }

  function burst(at, color, n, speed) {
    const mat = kit.line(color);
    for (let i = 0; i < n; i++) {
      const s = shards[next];
      next = (next + 1) % SHARDS;
      s.material = mat;
      s.position.copy(at);
      s.scale.setScalar(0.6 + Math.random() * 1.2);
      const d = s.userData;
      d.v.set(Math.random() - 0.5, Math.random() * 0.9 + 0.2, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.5 + Math.random()));
      d.spin.set(Math.random() * 8, Math.random() * 8, Math.random() * 8);
      d.max = d.life = 0.9 + Math.random() * 0.8;
      s.visible = true;
    }
  }

  /** The breakable unit: the solid group (ink body + coloured edges) that owns the hit mesh. */
  function partOf(obj) {
    let o = obj;
    while (o.parent && !(o.children.length === 2 && o.children[1].isLineSegments)) o = o.parent;
    return o.children.length === 2 && o.children[1].isLineSegments ? o : null;
  }

  function fireTracer(to) {
    const from = camera.localToWorld(tmp.set(1.4, -1.1, -2.5));
    const a = tracerGeo.attributes.position.array;
    a[0] = from.x; a[1] = from.y; a[2] = from.z; a[3] = to.x; a[4] = to.y; a[5] = to.z;
    tracerGeo.attributes.position.needsUpdate = true;
    tracerMat.color.copy(uniforms.uAccent.value);
    tracer.visible = true;
    tracerLife = TRACER_S;
  }

  /** Always fires. @returns {'break'|'spark'|'ground'|'miss'} */
  function shoot(x, y) {
    ndc.set(x, y);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(stations.children.filter((g) => g.visible), true).filter((h) => h.object.isMesh || h.object.isInstancedMesh);
    if (hits.length) {
      const { point, object } = hits[0];
      fireTracer(point);
      const part = partOf(object);
      const color = part ? `#${part.children[1].material.color.getHexString()}` : '#ece6da';
      if (part && !broken.some((b) => b.obj === part)) {
        box.setFromObject(part).getSize(size);
        if (Math.max(size.x, size.y, size.z) < ARMOR_SIZE) {
          burst(point, color, SHARDS_PER_HIT, 14);
          broken.push({ obj: part, t: 0, scale: part.scale.clone() });
          part.visible = false;
          return 'break';
        }
      }
      burst(point, color, 8, 9);
      return 'spark';
    }
    if (ray.ray.intersectPlane(ground, tmp) && tmp.distanceTo(camera.position) > MIN_RANGE) {
      fireTracer(tmp.clone());
      uniforms.uImpact.value.copy(tmp);
      uniforms.uImpactAge.value = 0;
      burst(tmp, `#${new Color(uniforms.uAccent.value).getHexString()}`, 10, 10);
      return 'ground';
    }
    const far = ray.ray.at(MISS_RANGE, new Vector3());
    fireTracer(far);
    burst(far, '#ece6da', 6, 6);
    return 'miss';
  }

  function update(dt) {
    uniforms.uImpactAge.value += dt;
    if (tracerLife > 0) { tracerLife -= dt; tracerMat.opacity = Math.max(0, tracerLife / TRACER_S); tracer.visible = tracerLife > 0; }
    for (const s of shards) {
      if (!s.visible) continue;
      const d = s.userData;
      d.life -= dt;
      if (d.life <= 0 || s.position.distanceTo(camera.position) < NEAR_CAMERA) { s.visible = false; continue; }
      d.v.y -= GRAVITY * dt;
      s.position.addScaledVector(d.v, dt);
      s.rotation.x += d.spin.x * dt; s.rotation.y += d.spin.y * dt; s.rotation.z += d.spin.z * dt;
      s.scale.multiplyScalar(1 - dt * 0.6);
    }
    for (let i = broken.length - 1; i >= 0; i--) {
      const b = broken[i];
      b.t += dt;
      if (b.t < REBUILD_S) continue;
      b.obj.visible = true;
      const k = Math.min(1, (b.t - REBUILD_S) / POP_S);
      const pop = k < 1 ? 1 + Math.sin(k * Math.PI) * 0.25 : 1; // overshoot, then settle
      b.obj.scale.copy(b.scale).multiplyScalar(Math.max(0.001, k * pop));
      if (k >= 1) { b.obj.scale.copy(b.scale); broken.splice(i, 1); }
    }
  }

  return { shoot, update };
}

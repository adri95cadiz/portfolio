// Small animated wireframe scenes that illustrate each chapter. All share one "kit" of
// materials/edge geometries so the scene can dispose everything in one call.
import {
  Group, Mesh, LineSegments, EdgesGeometry, BoxGeometry, CylinderGeometry, CapsuleGeometry,
  ConeGeometry, TorusGeometry, MeshBasicMaterial, LineBasicMaterial, InstancedMesh, Object3D,
} from 'three';

const TAU = Math.PI * 2;
const BONE = '#ece6da';

export function createKit() {
  const trash = [];
  const own = (x) => { trash.push(x); return x; };
  const body = own(new MeshBasicMaterial({ color: 0x0c0d10, transparent: true, opacity: 0.88 }));
  const lines = new Map();
  const edges = new Map();
  const line = (color, opacity = 1) => {
    const key = `${color}|${opacity}`;
    if (!lines.has(key)) lines.set(key, own(new LineBasicMaterial({ color, transparent: true, opacity })));
    return lines.get(key);
  };
  /** Ink body + coloured edges: the visual language of every object in the scene. */
  const solid = (geo, color, opacity = 1) => {
    if (!edges.has(geo)) edges.set(geo, own(new EdgesGeometry(geo, 20)));
    const g = new Group();
    g.add(new Mesh(geo, body), new LineSegments(edges.get(geo), line(color, opacity)));
    return g;
  };
  /** Edges only, for flat panels that must not hide what is behind them when seen from the back. */
  const outline = (geo, color, opacity = 1) => {
    if (!edges.has(geo)) edges.set(geo, own(new EdgesGeometry(geo, 20)));
    return new LineSegments(edges.get(geo), line(color, opacity));
  };
  return { solid, outline, line, geo: own, own, dispose: () => trash.forEach((t) => t.dispose()) };
}

/* 01 Origen — drones flying in formation over a little rover */
function drones(k, c) {
  const g = new Group();
  const hull = k.geo(new BoxGeometry(1.4, 0.35, 1.4));
  const arm = k.geo(new BoxGeometry(3.2, 0.1, 0.15));
  const rotor = k.geo(new CylinderGeometry(0.62, 0.62, 0.04, 8));
  const fleet = [0, 1, 2].map(() => {
    const d = new Group();
    const a1 = k.solid(arm, c); a1.rotation.y = Math.PI / 4;
    const a2 = k.solid(arm, c); a2.rotation.y = -Math.PI / 4;
    d.add(k.solid(hull, c), a1, a2);
    d.userData.rotors = [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([x, z]) => {
      const r = k.solid(rotor, BONE, 0.7); r.position.set(x * 1.13, 0.15, z * 1.13); d.add(r); return r;
    });
    g.add(d);
    return d;
  });
  const rover = new Group();
  const chassis = k.solid(k.geo(new BoxGeometry(2.4, 0.9, 3.2)), c, 0.8); chassis.position.y = 1;
  const mast = k.solid(k.geo(new BoxGeometry(0.2, 1.6, 0.2)), c, 0.8); mast.position.set(0, 2.2, 0.8);
  const dish = k.solid(k.geo(new ConeGeometry(0.7, 0.4, 8, 1, true)), BONE, 0.8); dish.position.set(0, 3.1, 0.8);
  rover.add(chassis, mast, dish);
  g.add(rover);
  return {
    group: g, offset: 15,
    update({ t }) {
      fleet.forEach((d, i) => {
        const a = t * 0.45 + (i * TAU) / 3;
        d.position.set(Math.cos(a) * 5.5, 8 + Math.sin(t * 1.3 + i) * 0.9, Math.sin(a) * 5.5);
        d.rotation.set(0, -a, Math.sin(t + i) * 0.15);
        for (const r of d.userData.rotors) r.rotation.y = t * 25;
      });
      rover.position.set(Math.cos(t * 0.3) * 3, 0, Math.sin(t * 0.3) * 3);
      rover.rotation.y = -t * 0.3;
      dish.rotation.y = t * 2;
    },
  };
}

/* 02 Go!Planner — trucks on a two-lane road, a container yard and a gantry crane */
function logistics(k, c) {
  const g = new Group();
  const LEN = 80;
  const road = k.solid(k.geo(new BoxGeometry(7, 0.05, LEN)), c, 0.35);
  road.position.set(-4, 0.4, 0);
  g.add(road);
  const dash = k.geo(new BoxGeometry(0.15, 0.05, 2.5));
  for (let z = -LEN / 2; z < LEN / 2; z += 6) { const d = k.solid(dash, c, 0.5); d.position.set(-4, 0.45, z); g.add(d); }

  const cab = k.geo(new BoxGeometry(2.2, 2.2, 2));
  const trailer = k.geo(new BoxGeometry(2.4, 2.6, 7));
  const loads = ['#ffb23e', '#9be7c4', '#6ea8ff', '#ff6f91', BONE, '#c79bff'];
  const trucks = loads.map((col, i) => {
    const tr = new Group();
    const head = k.solid(cab, c); head.position.set(0, 1.5, -4.8);
    const box = k.solid(trailer, col); box.position.y = 1.7;
    tr.add(head, box);
    const dir = i % 2 ? 1 : -1;
    tr.rotation.y = dir > 0 ? Math.PI : 0;
    tr.userData = { lane: dir > 0 ? -2.2 : -5.8, dir, off: (i * LEN) / loads.length };
    g.add(tr);
    return tr;
  });
  const pin = k.solid(k.geo(new ConeGeometry(0.8, 2, 4)), BONE);
  pin.rotation.x = Math.PI;
  g.add(pin);

  const box = k.geo(new BoxGeometry(2.6, 2.6, 6));
  for (let ix = 0; ix < 3; ix++) {
    for (let iz = 0; iz < 3; iz++) {
      const h = 1 + ((ix * 7 + iz * 3) % 3);
      for (let iy = 0; iy < h; iy++) {
        const ct = k.solid(box, loads[(ix + iz + iy) % loads.length], 0.85);
        ct.position.set(7 + ix * 3, 1.7 + iy * 2.7, -8 + iz * 7.5);
        g.add(ct);
      }
    }
  }
  const leg = k.geo(new BoxGeometry(0.45, 13, 0.45));
  const beam = k.geo(new BoxGeometry(12, 0.5, 0.5));
  for (const z of [-12, 12]) {
    for (const x of [4, 15]) { const l = k.solid(leg, c); l.position.set(x, 6.9, z); g.add(l); }
  }
  for (const z of [-12, 12]) { const b = k.solid(beam, c); b.position.set(9.5, 13.4, z); g.add(b); }
  const trolley = k.solid(k.geo(new BoxGeometry(1.6, 0.6, 25)), c);
  const lifted = k.solid(box, '#ff6f91');
  g.add(trolley, lifted);

  return {
    group: g, offset: 17,
    update({ t }) {
      for (const tr of trucks) {
        const { lane, dir, off } = tr.userData;
        const z = ((t * 7 + off) % LEN) - LEN / 2;
        tr.position.set(lane, 0, z * dir);
      }
      pin.position.set(trucks[0].position.x, 6.5 + Math.sin(t * 3) * 0.4, trucks[0].position.z);
      pin.rotation.y = t * 2;
      const x = 9.5 + Math.sin(t * 0.5) * 4.5;
      trolley.position.set(x, 12.9, 0);
      lifted.position.set(x, 8.5 + Math.sin(t * 1) * 2.5, 2);
    },
  };
}

/* 03.1 Slawly — the scales of justice, with encrypted documents in orbit */
function legal(k, c) {
  const g = new Group();
  const base = k.solid(k.geo(new CylinderGeometry(2, 2.6, 0.7, 6)), c); base.position.y = 0.6;
  const pole = k.solid(k.geo(new BoxGeometry(0.45, 9, 0.45)), c); pole.position.y = 5;
  const beam = new Group(); beam.position.y = 9.5;
  beam.add(k.solid(k.geo(new BoxGeometry(10, 0.3, 0.3)), c));
  const panG = k.geo(new CylinderGeometry(1.8, 1.1, 0.5, 10));
  const pans = [-1, 1].map(() => { const p = k.solid(panG, BONE, 0.85); g.add(p); return p; });
  g.add(base, pole, beam);
  const sheet = k.geo(new BoxGeometry(2.1, 0.05, 2.97));
  const docs = Array.from({ length: 6 }, (_, i) => { const d = k.solid(sheet, i % 2 ? c : BONE, 0.85); g.add(d); return d; });
  const lock = new Group();
  lock.add(k.solid(k.geo(new BoxGeometry(1.4, 1.1, 0.5)), c));
  const shackle = k.solid(k.geo(new TorusGeometry(0.45, 0.1, 4, 10, Math.PI)), c); shackle.position.y = 0.55;
  lock.add(shackle);
  g.add(lock);
  return {
    group: g, offset: 19,
    update({ t }) {
      const tilt = Math.sin(t * 0.8) * 0.18;
      beam.rotation.z = tilt;
      pans.forEach((p, i) => {
        const s = i ? 1 : -1;
        p.position.set(s * 5 * Math.cos(tilt), 9.5 + s * 5 * Math.sin(tilt) - 3, 0);
      });
      docs.forEach((d, i) => {
        const a = t * 0.35 + (i * TAU) / docs.length;
        d.position.set(Math.cos(a) * 7.5, 4 + (i % 3) * 2.4 + Math.sin(t + i) * 0.4, Math.sin(a) * 7.5);
        d.rotation.set(0.6 + Math.sin(t * 0.7 + i) * 0.3, -a, 0.2);
      });
      lock.position.set(0, 13 + Math.sin(t * 1.5) * 0.4, 0);
      lock.rotation.y = t;
    },
  };
}

/* 03.2 pan-flow — oven, conveyor of loaves, and the delivery van */
function bakery(k, c) {
  const g = new Group();
  const belt = k.solid(k.geo(new BoxGeometry(16, 0.5, 2.6)), c); belt.position.set(0, 2.2, 0);
  const oven = k.solid(k.geo(new BoxGeometry(5, 5, 5)), c); oven.position.set(-10, 2.6, 0);
  const mouth = k.solid(k.geo(new BoxGeometry(0.2, 2, 2.2)), '#ff5b1f'); mouth.position.set(-7.4, 2.6, 0);
  const chimney = k.solid(k.geo(new BoxGeometry(1, 3, 1)), c); chimney.position.set(-11, 6.5, -1);
  g.add(belt, oven, mouth, chimney);
  const loafG = k.geo(new CapsuleGeometry(0.5, 1.1, 3, 8));
  const loaves = Array.from({ length: 7 }, () => { const l = k.solid(loafG, BONE, 0.9); l.rotation.z = Math.PI / 2; g.add(l); return l; });
  const van = new Group();
  const vb = k.solid(k.geo(new BoxGeometry(3.2, 3.2, 5.5)), BONE); vb.position.y = 2;
  const vc = k.solid(k.geo(new BoxGeometry(3.2, 2.2, 2)), c); vc.position.set(0, 1.5, 3.8);
  const wheel = k.geo(new CylinderGeometry(0.6, 0.6, 0.4, 8));
  for (const [x, z] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 3.6], [1.6, 3.6]]) {
    const w = k.solid(wheel, c); w.rotation.z = Math.PI / 2; w.position.set(x, 0.6, z); van.add(w);
  }
  van.add(vb, vc);
  g.add(van);
  return {
    group: g, offset: 23,
    update({ t }) {
      loaves.forEach((l, i) => {
        const u = (t * 0.18 + i / loaves.length) % 1;
        l.position.set(-7 + u * 15, 2.9 + (u > 0.93 ? (u - 0.93) * -20 : 0), 0);
      });
      const cycle = (t * 0.08) % 1; // van waits, then drives off and comes back
      const z = cycle < 0.5 ? 0 : (cycle - 0.5) * 2 * -60;
      van.position.set(11, 0, z);
      van.rotation.y = Math.PI;
    },
  };
}

/* 03.3 Workrawler — a radar sweep over a city, pinning the companies that are hiring */
function crawler(k, c) {
  const g = new Group();
  const unit = k.geo(new BoxGeometry(2, 1, 2));
  const dim = k.line(c, 0.25);
  const lit = k.line(c, 1);
  const pinG = k.geo(new ConeGeometry(0.5, 1.4, 4));
  const blocks = [];
  for (let ix = -3; ix <= 3; ix++) {
    for (let iz = -3; iz <= 3; iz++) {
      if (!ix && !iz) continue;
      const h = 1 + ((ix * 13 + iz * 7 + 49) % 6);
      const b = k.solid(unit, c, 0.25);
      b.scale.y = h;
      b.position.set(ix * 3, h / 2 + 0.4, iz * 3);
      const hiring = (ix * 5 + iz * 11 + 40) % 4 === 0;
      let pin = null;
      if (hiring) { pin = k.solid(pinG, BONE); pin.rotation.x = Math.PI; pin.position.set(ix * 3, h + 2, iz * 3); g.add(pin); }
      b.userData = { angle: Math.atan2(-iz, ix), pin };
      blocks.push(b);
      g.add(b);
    }
  }
  const tower = k.solid(k.geo(new CylinderGeometry(0.4, 0.7, 8, 6)), c); tower.position.y = 4.4;
  const beamG = k.geo(new BoxGeometry(12, 0.08, 0.3)); beamG.translate(6, 0, 0);
  const beam = k.solid(beamG, '#ff5b1f');
  beam.position.y = 8.4;
  g.add(tower, beam);
  return {
    group: g, offset: 25,
    update({ t }) {
      const sweep = (t * 1.1) % TAU;
      beam.rotation.y = sweep;
      for (const b of blocks) {
        const since = (sweep - b.userData.angle + TAU * 2) % TAU; // radians since the beam passed
        b.children[1].material = since < 0.6 ? lit : dim;
        const { pin } = b.userData;
        if (pin) {
          const s = Math.max(0, 1 - since / 4);
          pin.scale.setScalar(0.001 + s);
          pin.rotation.y = t * 3;
        }
      }
    },
  };
}

/* 03.4 QRasca — a QR code being "scratched" into existence, and a stamp card filling up */
function qr(k, c) {
  const g = new Group();
  g.scale.setScalar(0.6);
  const N = 21;
  const cells = [];
  const finder = (r, col) => {
    for (const [fr, fc] of [[0, 0], [0, N - 7], [N - 7, 0]]) {
      const y = r - fr; const x = col - fc;
      if (y >= 0 && y < 7 && x >= 0 && x < 7) return y === 0 || y === 6 || x === 0 || x === 6 || (y >= 2 && y <= 4 && x >= 2 && x <= 4) ? 1 : 0;
    }
    return -1;
  };
  for (let r = 0; r < N; r++) {
    for (let col = 0; col < N; col++) {
      const f = finder(r, col);
      const noise = Math.abs(Math.sin(r * 12.9898 + col * 78.233) * 43758.5453) % 1; // deterministic hash
      const on = f === -1 ? noise > 0.5 : f === 1;
      if (on) cells.push([r, col]);
    }
  }
  const mesh = new InstancedMesh(k.geo(new BoxGeometry(0.88, 0.88, 0.88)), k.own(new MeshBasicMaterial({ color: c })), cells.length);
  g.add(mesh);
  const frame = k.outline(k.geo(new BoxGeometry(N + 2, N + 2, 0.4)), c, 0.5); frame.position.set(0, N / 2 + 2, -0.8);
  g.add(frame);
  const coin = k.solid(k.geo(new CylinderGeometry(1.4, 1.4, 0.3, 14)), BONE); coin.rotation.x = Math.PI / 2;
  g.add(coin);

  const card = new Group(); card.position.set(N / 2 + 9, 6, 2);
  card.add(k.outline(k.geo(new BoxGeometry(11, 5.4, 0.3)), BONE, 0.7));
  const ring = k.geo(new TorusGeometry(0.75, 0.08, 4, 16));
  const stampG = k.geo(new CylinderGeometry(0.6, 0.6, 0.2, 12));
  const stamps = [];
  for (let i = 0; i < 10; i++) {
    const x = -4 + (i % 5) * 2; const y = i < 5 ? 1.2 : -1.2;
    const rg = k.solid(ring, BONE, 0.6); rg.position.set(x, y, 0.3); card.add(rg);
    const st = k.solid(stampG, c); st.rotation.x = Math.PI / 2; st.position.set(x, y, 0.35); card.add(st); stamps.push(st);
  }
  g.add(card);

  const o = new Object3D();
  return {
    group: g, offset: 28,
    update({ t }) {
      const phase = (t * 0.25) % 1.6; // 0..1 reveal, then hold
      cells.forEach(([r, col], i) => {
        const d = (r + col) / (2 * N);
        const s = Math.min(Math.max((phase - d) * 6, 0), 1);
        o.position.set(col - N / 2 + 0.5, N - r + 1.5, s * 0.4);
        o.scale.setScalar(Math.max(s, 0.001));
        o.updateMatrix();
        mesh.setMatrixAt(i, o.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      const front = Math.min(phase, 1) * N * 2;
      coin.position.set(front / 2 - N / 2, N + 1.5 - front / 2, 1.2);
      coin.visible = phase < 1;
      const filled = Math.floor((t * 1.2) % 13);
      stamps.forEach((st, i) => { st.visible = i < filled; });
    },
  };
}

/* 05 Athetosis — speaker stacks and 16 pads that follow the drum machine */
function music(k, c) {
  const g = new Group();
  const padG = k.geo(new BoxGeometry(1.5, 0.5, 1.5));
  const off = k.line(c, 0.3);
  const on = k.line(BONE, 1);
  const pads = Array.from({ length: 16 }, (_, i) => {
    const p = k.solid(padG, c, 0.3); p.position.set(-12 + i * 1.6 + Math.floor(i / 4) * 0.5, 1, 6); g.add(p); return p;
  });
  const cab = k.geo(new BoxGeometry(4.5, 4.5, 3.5));
  const cone = k.geo(new TorusGeometry(1.4, 0.18, 4, 18));
  const tweeter = k.geo(new TorusGeometry(0.5, 0.1, 4, 12));
  const woofers = [];
  for (const x of [-11, 11]) {
    for (let iy = 0; iy < 3; iy++) {
      const s = k.solid(cab, c, 0.9); s.position.set(x, 2.6 + iy * 4.6, 0); g.add(s);
      const w = k.solid(iy === 2 ? tweeter : cone, BONE); w.position.set(x, 2.6 + iy * 4.6, 1.85); g.add(w); woofers.push(w);
    }
  }
  return {
    group: g, offset: 18,
    update({ t, audio, step }) {
      const boom = 1 + audio * 0.6;
      for (const w of woofers) w.scale.set(boom, boom, 1);
      pads.forEach((p, i) => {
        const active = i === step;
        p.children[1].material = active ? on : off;
        p.position.y = active ? 1.6 : 1 + Math.sin(t * 2 + i * 0.4) * 0.08;
      });
    },
  };
}

const BUILDERS = { drones, logistics, legal, bakery, crawler, qr, music };

/** @returns {{group: Group, offset: number, update: (ctx:{t:number,audio:number,step:number}) => void}} */
export function buildDiorama(kind, color, kit) {
  return (BUILDERS[kind] ?? drones)(kit, color);
}

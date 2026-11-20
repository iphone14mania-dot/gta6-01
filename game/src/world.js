// Coral Harbor itself: a seeded grid city at golden hour — streets, buildings
// with lit windows, palms, a beach and an ocean, plus the collision data the
// cars, peds and player all share. Everything is procedural; no asset files.

import * as THREE from '../vendor/three.min.js';
import { CITY, PALETTE } from './config.js';
import { createRandom, pick, range, intRange } from './random.js';

function streetPositions() {
  const half = ((CITY.streetCount - 1) / 2) * CITY.streetSpacing;
  const list = [];
  for (let i = 0; i < CITY.streetCount; i++) list.push(-half + i * CITY.streetSpacing);
  return list;
}

function makeFacadeTexture(rand, base, litRatio) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 128, 256);
  g.fillStyle = 'rgba(0,0,0,0.18)';
  for (let y = 0; y < 256; y += 32) g.fillRect(0, y, 128, 3);
  for (let y = 10; y < 250; y += 32) {
    for (let x = 10; x < 120; x += 28) {
      const lit = rand() < litRatio;
      g.fillStyle = lit ? '#ffd27a' : '#1d2733';
      g.fillRect(x, y, 18, 20);
      if (lit) {
        g.fillStyle = 'rgba(255,210,122,0.25)';
        g.fillRect(x - 2, y - 2, 22, 24);
      }
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeRoadTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#2b2f38';
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = 'rgba(255,255,255,0.05)';
  for (let i = 0; i < 400; i++) g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  g.fillStyle = '#d8d3a8';
  for (let y = 0; y < 256; y += 64) g.fillRect(126, y + 8, 4, 32);
  g.fillStyle = '#e8e4cc';
  g.fillRect(8, 0, 3, 256);
  g.fillRect(245, 0, 3, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeSkyTexture() {
  const c = document.createElement('canvas');
  c.width = 16;
  c.height = 512;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#1c1038');
  grad.addColorStop(0.35, '#4a2358');
  grad.addColorStop(0.6, '#c94b6d');
  grad.addColorStop(0.78, '#ff9a5c');
  grad.addColorStop(0.92, '#ffd9a0');
  grad.addColorStop(1, '#ffe9c4');
  g.fillStyle = grad;
  g.fillRect(0, 0, 16, 512);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeGlowTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,240,200,1)');
  grad.addColorStop(0.3, 'rgba(255,200,120,0.55)');
  grad.addColorStop(1, 'rgba(255,160,80,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createWorld(scene, seed) {
  const rand = createRandom(seed);
  const streets = streetPositions();
  const group = new THREE.Group();
  scene.add(group);

  // --- sky dome, sun and fog -------------------------------------------------
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(2200, 24, 16),
    new THREE.MeshBasicMaterial({ map: makeSkyTexture(), side: THREE.BackSide, fog: false }),
  );
  sky.position.y = -40;
  group.add(sky);
  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeGlowTexture(), transparent: true, fog: false, depthWrite: false,
  }));
  sunSprite.position.set(-900, 260, -1400);
  sunSprite.scale.set(700, 700, 1);
  group.add(sunSprite);

  const sun = new THREE.DirectionalLight(PALETTE.sun, 2.8);
  sun.position.set(-400, 320, -500);
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0x8a6bb0, 0x3a2a3a, 1.6));
  scene.fog = new THREE.Fog(PALETTE.fog, 250, 1600);

  // --- ground: grass base, roads, beach, ocean --------------------------------
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(2400, 2400),
    new THREE.MeshLambertMaterial({ color: PALETTE.grass }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  group.add(ground);

  const roadTex = makeRoadTexture();
  const roadMat = new THREE.MeshLambertMaterial({ map: roadTex });
  const sidewalkMat = new THREE.MeshLambertMaterial({ color: PALETTE.sidewalk });
  const roadLen = CITY.bounds * 2 + CITY.roadWidth;
  for (const s of streets) {
    for (const vertical of [true, false]) {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(CITY.roadWidth, roadLen), roadMat);
      road.rotation.x = -Math.PI / 2;
      if (!vertical) road.rotation.z = Math.PI / 2;
      road.position.set(vertical ? s : 0, 0, vertical ? 0 : s);
      group.add(road);
      const walk = new THREE.Mesh(new THREE.PlaneGeometry(CITY.roadWidth + 6, roadLen), sidewalkMat);
      walk.rotation.x = -Math.PI / 2;
      if (!vertical) walk.rotation.z = Math.PI / 2;
      walk.position.set(vertical ? s : 0, -0.02, vertical ? 0 : s);
      group.add(walk);
    }
  }

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(120, roadLen),
    new THREE.MeshLambertMaterial({ color: PALETTE.sand }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(CITY.beachX + 40, 0.01, 0);
  group.add(sand);
  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(1200, 2400),
    new THREE.MeshLambertMaterial({ color: PALETTE.ocean, transparent: true, opacity: 0.92 }),
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(CITY.oceanX + 600, 0.02, 0);
  group.add(ocean);

  // --- buildings ---------------------------------------------------------------
  const facadeMats = PALETTE.building.map((hex) => {
    const base = `#${hex.toString(16).padStart(6, '0')}`;
    return new THREE.MeshLambertMaterial({ map: makeFacadeTexture(rand, base, 0.55) });
  });
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x4a4450 });
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const colliders = []; // {minX, maxX, minZ, maxZ}
  const buildings = [];
  const halfBlock = CITY.blockSize / 2;
  for (let ix = 0; ix < streets.length - 1; ix++) {
    for (let iz = 0; iz < streets.length - 1; iz++) {
      const cx = (streets[ix] + streets[ix + 1]) / 2;
      const cz = (streets[iz] + streets[iz + 1]) / 2;
      const distCenter = Math.hypot(cx, cz);
      const roll = rand();
      if (roll < 0.12) continue; // park / empty lot
      const downtown = distCenter < 220;
      const h = downtown ? range(rand, 26, 78) : range(rand, 10, 30);
      const w = range(rand, 34, halfBlock * 2 - 14);
      const d = range(rand, 34, halfBlock * 2 - 14);
      const mesh = new THREE.Mesh(boxGeo, pick(rand, facadeMats));
      mesh.scale.set(w, h, d);
      mesh.position.set(cx, h / 2, cz);
      group.add(mesh);
      const roof = new THREE.Mesh(boxGeo, roofMat);
      roof.scale.set(w * 0.92, 1.2, d * 0.92);
      roof.position.set(cx, h + 0.6, cz);
      group.add(roof);
      if (rand() < 0.4) {
        const ac = new THREE.Mesh(boxGeo, roofMat);
        ac.scale.set(4, 2.5, 3);
        ac.position.set(cx + range(rand, -w / 4, w / 4), h + 2, cz + range(rand, -d / 4, d / 4));
        group.add(ac);
      }
      colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
      buildings.push({ x: cx, z: cz, w, d, h });
    }
  }

  // Landmarks: stadium dome, dock cranes, airfield tower.
  const stadium = new THREE.Mesh(
    new THREE.CylinderGeometry(46, 52, 22, 24),
    new THREE.MeshLambertMaterial({ color: 0xb8b0a8 }),
  );
  stadium.position.set(-162, 11, 162);
  group.add(stadium);
  colliders.push({ minX: -208, maxX: -116, minZ: 116, maxZ: 208 });
  for (let i = 0; i < 3; i++) {
    const crane = new THREE.Group();
    const leg = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0xc96a3a }));
    leg.scale.set(4, 34, 4);
    leg.position.y = 17;
    crane.add(leg);
    const arm = new THREE.Mesh(boxGeo, leg.material);
    arm.scale.set(34, 3, 3);
    arm.position.set(12, 33, 0);
    crane.add(arm);
    crane.position.set(420 + i * 36, 0, 470);
    group.add(crane);
  }

  // --- palms and streetlights (instanced) --------------------------------------
  const palmTrunk = new THREE.CylinderGeometry(0.5, 0.8, 9, 6);
  const palmTop = new THREE.ConeGeometry(5.5, 7, 7);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5a3a });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2e7d32 });
  const palmSpots = [];
  for (let z = -520; z <= 520; z += 52) {
    palmSpots.push([CITY.beachX + 8, z + range(rand, -8, 8)]);
    palmSpots.push([CITY.beachX + 26, z + 26 + range(rand, -8, 8)]);
  }
  for (const s of streets) {
    for (let t = -486; t <= 486; t += 216) {
      if (rand() < 0.5) palmSpots.push([s + 13, t]);
      if (rand() < 0.5) palmSpots.push([t, s - 13]);
    }
  }
  const trunks = new THREE.InstancedMesh(palmTrunk, trunkMat, palmSpots.length);
  const tops = new THREE.InstancedMesh(palmTop, leafMat, palmSpots.length);
  const dummy = new THREE.Object3D();
  palmSpots.forEach(([x, z], i) => {
    dummy.position.set(x, 4.5, z);
    dummy.rotation.set(0, rand() * Math.PI, 0);
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
    dummy.position.y = 11;
    dummy.updateMatrix();
    tops.setMatrixAt(i, dummy.matrix);
  });
  group.add(trunks);
  group.add(tops);

  const lampPole = new THREE.CylinderGeometry(0.25, 0.3, 9, 6);
  const lampHead = new THREE.SphereGeometry(0.9, 8, 6);
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x3a3f4a });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9b0 });
  const lampSpots = [];
  for (const s of streets) {
    for (let t = -486; t <= 486; t += 108) {
      lampSpots.push([s + 11, t]);
      lampSpots.push([s - 11, t + 54]);
    }
  }
  const poles = new THREE.InstancedMesh(lampPole, poleMat, lampSpots.length);
  const heads = new THREE.InstancedMesh(lampHead, lampMat, lampSpots.length);
  lampSpots.forEach(([x, z], i) => {
    dummy.position.set(x, 4.5, z);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    poles.setMatrixAt(i, dummy.matrix);
    dummy.position.y = 9.2;
    dummy.updateMatrix();
    heads.setMatrixAt(i, dummy.matrix);
  });
  group.add(poles);
  group.add(heads);

  // --- collision + queries ------------------------------------------------------
  function collideCircle(x, z, r) {
    // Returns a corrected {x, z} pushed out of every building and the bounds.
    let px = x;
    let pz = z;
    for (const c of colliders) {
      const nx = Math.max(c.minX, Math.min(px, c.maxX));
      const nz = Math.max(c.minZ, Math.min(pz, c.maxZ));
      const dx = px - nx;
      const dz = pz - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 > 0.0001) {
          const d = Math.sqrt(d2);
          px = nx + (dx / d) * r;
          pz = nz + (dz / d) * r;
        } else {
          // centre inside the box: push out along the smallest penetration
          const left = px - c.minX;
          const right = c.maxX - px;
          const up = pz - c.minZ;
          const down = c.maxZ - pz;
          const m = Math.min(left, right, up, down);
          if (m === left) px = c.minX - r;
          else if (m === right) px = c.maxX + r;
          else if (m === up) pz = c.minZ - r;
          else pz = c.maxZ + r;
        }
      }
    }
    const b = CITY.bounds;
    px = Math.max(-b, Math.min(b + 90, px));
    pz = Math.max(-b, Math.min(b, pz));
    return { x: px, z: pz };
  }

  function isOnRoad(x, z) {
    const hw = CITY.roadWidth / 2;
    for (const s of streets) {
      if (Math.abs(x - s) < hw || Math.abs(z - s) < hw) return true;
    }
    return false;
  }

  function nearestStreet(x, z) {
    let best = streets[0];
    let bd = Infinity;
    let vertical = true;
    for (const s of streets) {
      const dx = Math.abs(x - s);
      const dz = Math.abs(z - s);
      if (dx < bd) { bd = dx; best = s; vertical = true; }
      if (dz < bd) { bd = dz; best = s; vertical = false; }
    }
    return { at: best, vertical, dist: bd };
  }

  return {
    group, streets, buildings, colliders, collideCircle, isOnRoad, nearestStreet,
    update() { /* static city; the ocean shimmer lives in the renderer */ },
  };
}

// The Coral Harbor PD: a 5-star wanted system. Cop cars chase and ram, cops on
// foot try to bust the player, roadblocks appear at 3 stars and the CONDOR
// helicopter hunts from above at 4. Lose them by breaking line of sight.

import * as THREE from '../vendor/three.min.js';
import { WANTED, CITY } from './config.js';
import { createCar, driveCar } from './vehicles.js';
import { pick, range } from './random.js';

function buildHeliMesh() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x1a2a4a });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.6, 5.2), bodyMat);
  g.add(body);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 4), bodyMat);
  tail.position.set(0, 0.3, -4);
  g.add(tail);
  const rotorMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(9, 0.08, 0.3), rotorMat);
  rotor.position.y = 1.1;
  g.add(rotor);
  const skidMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
  for (const s of [-1, 1]) {
    const skid = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 4), skidMat);
    skid.position.set(s * 1.1, -1, 0);
    g.add(skid);
  }
  const spot = new THREE.Mesh(
    new THREE.ConeGeometry(6, 26, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }),
  );
  spot.position.y = -14;
  spot.rotation.x = Math.PI;
  g.add(spot);
  g.userData.rotor = rotor;
  return g;
}

export function createPolice(scene, world, rand, audio) {
  let stars = 0;
  let hiddenTimer = 0;
  let bustTimer = 0;
  const copCars = [];
  const footCops = [];
  const roadblocks = [];
  let heli = null;
  let heliForced = false;
  let spawnTimer = 0;

  function setStars(n, silent) {
    const next = Math.max(0, Math.min(WANTED.maxStars, n));
    if (next !== stars) {
      stars = next;
      hiddenTimer = 0;
      audio.setSiren(stars > 0);
      if (!silent && stars > 0) audio.setSiren(true);
    }
    return stars;
  }

  function spawnCopCar(playerPos) {
    // spawn on a street near the player but out of immediate sight
    const street = pick(rand, world.streets);
    const vertical = rand() < 0.5;
    const dir = pick(rand, [-1, 1]);
    const x = vertical ? street + 4.5 : playerPos.x + dir * range(rand, 45, 80);
    const z = vertical ? playerPos.z + dir * range(rand, 45, 80) : street + 4.5;
    const car = createCar(scene, 'police', 0x1a2a4a, x, z, Math.atan2(playerPos.x - x, playerPos.z - z));
    car.driver = 'police';
    copCars.push(car);
    return car;
  }

  function spawnRoadblock(playerPos, heading) {
    // two cop cars parked across the road ahead of the player
    const ahead = 55;
    const bx = playerPos.x + Math.sin(heading) * ahead;
    const bz = playerPos.z + Math.cos(heading) * ahead;
    const perp = heading + Math.PI / 2;
    for (const off of [-4, 4]) {
      const car = createCar(scene, 'police', 0x1a2a4a,
        bx + Math.sin(perp) * off, bz + Math.cos(perp) * off, perp);
      car.driver = 'police';
      car.blocking = true;
      roadblocks.push(car);
      copCars.push(car);
    }
  }

  function spawnHeli(playerPos) {
    if (heli) return;
    const mesh = buildHeliMesh();
    mesh.position.set(playerPos.x + 40, 55, playerPos.z - 40);
    scene.add(mesh);
    heli = { mesh, x: mesh.position.x, z: mesh.position.z, y: 55 };
  }

  function clearAll() {
    for (const c of copCars) c.dispose();
    copCars.length = 0;
    roadblocks.length = 0;
    for (const f of footCops) scene.remove(f.mesh);
    footCops.length = 0;
    if (heli) {
      scene.remove(heli.mesh);
      heli = null;
    }
    setStars(0, true);
    audio.setSiren(false);
  }

  function update(dt, player, world, trafficCars, onBusted) {
    if (stars === 0) {
      if (copCars.length > 0) clearAll();
      return;
    }
    // maintain the cop-car fleet
    spawnTimer -= dt;
    const want = WANTED.copCars[stars];
    const active = copCars.filter((c) => !c.blocking && !c.dead).length;
    if (spawnTimer <= 0 && active < want) {
      spawnCopCar(player);
      spawnTimer = 2.5;
    }
    // roadblocks at 3+
    if (stars >= WANTED.roadblockAt && roadblocks.length === 0 && player.car && Math.random() < dt * 0.1) {
      spawnRoadblock(player, player.car.heading);
    }
    // helicopter at 4+
    if (stars >= WANTED.heliAt) spawnHeli(player);
    else if (heli && !heliForced) {
      scene.remove(heli.mesh);
      heli = null;
    }
    if (heli && !heliForced) {
      const tx = player.x + 12;
      const tz = player.z - 12;
      heli.x += (tx - heli.x) * Math.min(1, dt * 0.8);
      heli.z += (tz - heli.z) * Math.min(1, dt * 0.8);
      heli.mesh.position.set(heli.x, 55 + Math.sin(performance.now() / 700) * 1.5, heli.z);
      heli.mesh.rotation.y = Math.atan2(player.x - heli.x, player.z - heli.z);
      heli.mesh.userData.rotor.rotation.y += dt * 30;
    } else if (heli) {
      // staged helicopter: hold position, rotors spinning
      heli.mesh.position.y = heli.y + Math.sin(performance.now() / 700) * 1.5;
      heli.mesh.userData.rotor.rotation.y += dt * 30;
    }

    let seen = false;
    for (const car of copCars) {
      if (car.dead) continue;
      if (car.blocking) {
        car.updateVisual(dt);
        continue;
      }
      const dx = player.x - car.x;
      const dz = player.z - car.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 120) seen = true;
      // chase steering: aim at a point ahead of the player
      const lead = player.car ? 1.2 : 0.4;
      const tx = player.x + Math.sin(player.heading) * (player.car ? player.car.speed * 0.4 : 0);
      const tz = player.z + Math.cos(player.heading) * (player.car ? player.car.speed * 0.4 : 0);
      const wantHeading = Math.atan2(tx - car.x, tz - car.z);
      let dh = wantHeading - car.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      const input = {
        forward: dist > 6 ? 1 : 0.3,
        strafe: Math.max(-1, Math.min(1, dh * 2.2)),
        handbrake: false,
      };
      driveCar(car, input, dt, world, [...trafficCars, ...copCars]);
      car.updateVisual(dt);
      // ram damage
      if (dist < 4.6 && player.car) {
        player.car.damage += dt * 0.05;
      }
      // busted: cop on foot range and player slow/on foot
      if (!player.car && dist < 3.2 && player.health > 0) {
        bustTimer += dt;
        if (bustTimer > 1.6) {
          onBusted();
          bustTimer = 0;
        }
      }
    }
    if (heli) seen = true; // the helicopter always watches
    if (seen) {
      hiddenTimer = 0;
      bustTimer = 0;
    } else {
      hiddenTimer += dt;
      if (hiddenTimer > WANTED.hideTime[stars]) {
        setStars(stars - 1);
      }
    }
    // wrecked cop cars get towed away
    for (let i = copCars.length - 1; i >= 0; i--) {
      const c = copCars[i];
      if (c.damage > 1) {
        c.dead = true;
        c.dispose();
        copCars.splice(i, 1);
        const rb = roadblocks.indexOf(c);
        if (rb !== -1) roadblocks.splice(rb, 1);
      }
    }
  }

  return {
    get stars() { return stars; },
    get copCars() { return copCars; },
    get heliActive() { return !!heli; },
    setStars,
    addStars(n) { return setStars(stars + n); },
    update,
    clearAll,
    // staging helpers for the cover screenshot
    forceRoadblock(pos, heading) { spawnRoadblock(pos, heading); },
    placeHeli(x, y, z) {
      spawnHeli({ x, z });
      heliForced = true;
      heli.x = x;
      heli.z = z;
      heli.y = y;
      heli.mesh.position.set(x, y, z);
    },
  };
}

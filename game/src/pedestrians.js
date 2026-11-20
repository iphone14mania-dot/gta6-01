// Pedestrians: simple stylized people who stroll the sidewalks, chat, and run
// for cover when shots are fired. They make the city feel alive.

import * as THREE from '../vendor/three.min.js';
import { CITY } from './config.js';
import { pick, range } from './random.js';

const SKINS = [0xf2c9a0, 0xc98a5a, 0x8a5a3a, 0xf2e0c8, 0x6a4a2a];
const SHIRTS = [0xd43a2a, 0x2a6ad4, 0x20b8a0, 0xf2c94c, 0xe8e8e8, 0x8a5aa0, 0x3a3a3e, 0x7ac74a];
const PANTS = [0x2a3548, 0x4a4a52, 0x6a5a3a, 0x1e2a3a];

function buildPedMesh(rand) {
  const g = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: pick(rand, SKINS) });
  const shirt = new THREE.MeshLambertMaterial({ color: pick(rand, SHIRTS) });
  const pants = new THREE.MeshLambertMaterial({ color: pick(rand, PANTS) });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.3), shirt);
  torso.position.y = 1.15;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), skin);
  head.position.y = 1.7;
  g.add(head);
  const legs = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.8, 0.24), pants);
    leg.geometry.translate(0, -0.4, 0);
    leg.position.set(s * 0.15, 0.8, 0);
    g.add(leg);
    legs.push(leg);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.7, 0.18), shirt);
    arm.geometry.translate(0, -0.35, 0);
    arm.position.set(s * 0.36, 1.45, 0);
    g.add(arm);
    legs.push(arm);
  }
  g.userData.legs = legs;
  return g;
}

export function createPedestrians(scene, world, rand, count) {
  const peds = [];
  function spawnPed(near) {
    const street = pick(rand, world.streets);
    const vertical = rand() < 0.5;
    const side = pick(rand, [-1, 1]) * 13;
    const along = near ? near.z + range(rand, -90, 90) : range(rand, -CITY.bounds, CITY.bounds);
    const x = vertical ? street + side : along;
    const z = vertical ? along : street + side;
    const mesh = buildPedMesh(rand);
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    const ped = {
      mesh, x, z,
      heading: vertical ? (rand() < 0.5 ? 0 : Math.PI) : (rand() < 0.5 ? Math.PI / 2 : -Math.PI / 2),
      speed: range(rand, 1.2, 2.2),
      vertical, street, side,
      state: 'walk', // walk | flee | down
      walkPhase: rand() * Math.PI * 2,
      downTimer: 0,
    };
    peds.push(ped);
    return ped;
  }
  for (let i = 0; i < count; i++) spawnPed(null);

  function scare(x, z, radius) {
    for (const ped of peds) {
      if (ped.state === 'down') continue;
      if (Math.hypot(ped.x - x, ped.z - z) < radius) {
        ped.state = 'flee';
        ped.heading = Math.atan2(ped.x - x, ped.z - z) + range(rand, -0.5, 0.5);
        ped.speed = range(rand, 5, 7);
      }
    }
  }

  function knockDown(ped) {
    ped.state = 'down';
    ped.downTimer = 6;
    ped.mesh.rotation.x = Math.PI / 2;
    ped.mesh.position.y = 0.25;
  }

  function update(dt, playerPos) {
    for (const ped of peds) {
      if (ped.state === 'down') {
        ped.downTimer -= dt;
        if (ped.downTimer <= 0) {
          ped.state = 'flee';
          ped.mesh.rotation.x = 0;
          ped.mesh.position.y = 0;
          ped.speed = 6;
        }
        continue;
      }
      const step = ped.speed * dt;
      ped.x += Math.sin(ped.heading) * step;
      ped.z += Math.cos(ped.heading) * step;
      if (ped.state === 'walk') {
        // stay near the sidewalk line; turn at intersections sometimes
        const fixed = world.collideCircle(ped.x, ped.z, 0.6);
        ped.x = fixed.x;
        ped.z = fixed.z;
        if (rand() < dt * 0.08) {
          ped.heading += pick(rand, [-Math.PI / 2, Math.PI / 2]);
        }
        if (Math.abs(ped.x) > CITY.bounds || Math.abs(ped.z) > CITY.bounds) {
          ped.heading += Math.PI;
        }
      } else {
        // fleeing: run straight, bounce off buildings
        const fixed = world.collideCircle(ped.x, ped.z, 0.6);
        if (Math.hypot(fixed.x - ped.x, fixed.z - ped.z) > 0.01) ped.heading += Math.PI / 2;
        ped.x = fixed.x;
        ped.z = fixed.z;
        if (rand() < dt * 0.2) ped.state = 'walk';
      }
      ped.walkPhase += dt * ped.speed * 2.2;
      const swing = Math.sin(ped.walkPhase) * 0.55;
      const [l1, a1, l2, a2] = ped.mesh.userData.legs;
      l1.rotation.x = swing;
      l2.rotation.x = -swing;
      a1.rotation.x = -swing;
      a2.rotation.x = swing;
      ped.mesh.position.set(ped.x, ped.mesh.position.y, ped.z);
      ped.mesh.rotation.y = ped.heading;
    }
    // recycle peds that wandered far from the player
    if (playerPos) {
      for (const ped of peds) {
        if (Math.hypot(ped.x - playerPos.x, ped.z - playerPos.z) > 300) {
          scene.remove(ped.mesh);
          peds.splice(peds.indexOf(ped), 1);
          spawnPed(playerPos);
          break;
        }
      }
    }
  }

  return { peds, update, scare, knockDown, spawnPed };
}

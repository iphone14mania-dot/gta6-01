// Milo Reyes, the player: on-foot movement with a third-person character,
// entering and leaving cars, health, money and the weapon inventory.

import * as THREE from '../vendor/three.min.js';
import { PLAYER, WEAPONS, WEAPON_ORDER } from './config.js';

function buildPlayerMesh() {
  const g = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98a5a });
  const jacket = new THREE.MeshLambertMaterial({ color: 0x2a6ad4 });
  const jeans = new THREE.MeshLambertMaterial({ color: 0x2a3548 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.75, 0.32), jacket);
  torso.position.y = 1.18;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), skin);
  head.position.y = 1.76;
  g.add(head);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.5),
    new THREE.MeshLambertMaterial({ color: 0xd43a2a }));
  cap.position.y = 1.95;
  g.add(cap);
  const limbs = {};
  for (const [name, s, mat] of [['legL', -1, jeans], ['legR', 1, jeans], ['armL', -1, jacket], ['armR', 1, jacket]]) {
    const isLeg = name.startsWith('leg');
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.22, isLeg ? 0.85 : 0.7, 0.24), mat);
    m.geometry.translate(0, isLeg ? -0.42 : -0.35, 0);
    m.position.set(s * (isLeg ? 0.16 : 0.4), isLeg ? 0.82 : 1.48, 0);
    g.add(m);
    limbs[name] = m;
  }
  g.userData.limbs = limbs;
  return g;
}

export function createPlayer(scene, x, z) {
  const mesh = buildPlayerMesh();
  mesh.position.set(x, 0, z);
  scene.add(mesh);
  const player = {
    mesh, x, z,
    heading: 0,
    vy: 0,
    grounded: true,
    health: PLAYER.health,
    money: 250,
    respect: 0,
    respectRank: 0,
    car: null, // the car object when driving
    weapons: { pistol: { ammo: 12, reserve: 60 } },
    weapon: 'pistol',
    walkPhase: 0,
    moving: false,
    dead: false,
    stats: { missionsDone: 0, carsStolen: 0, distanceDriven: 0, shotsFired: 0 },
    get speed() {
      return player.car ? Math.abs(player.car.speed) : 0;
    },
    giveWeapon(id) {
      if (!player.weapons[id]) {
        player.weapons[id] = { ammo: WEAPONS[id].mag, reserve: WEAPONS[id].mag * 3 };
      }
    },
    cycleWeapon(dir) {
      const owned = WEAPON_ORDER.filter((w) => player.weapons[w]);
      const i = owned.indexOf(player.weapon);
      player.weapon = owned[(i + dir + owned.length) % owned.length];
    },
    selectWeapon(id) {
      if (player.weapons[id]) player.weapon = id;
    },
    addRespect(n) {
      player.respect += n;
      const ranks = [0, 150, 400, 800, 1400];
      let r = 0;
      for (let i = 0; i < ranks.length; i++) if (player.respect >= ranks[i]) r = i;
      player.respectRank = r;
    },
    rankName() {
      return ['Street', 'Runner', 'Wheelman', 'Shot Caller', 'Kingpin'][player.respectRank];
    },
    hurt(amount) {
      if (player.dead) return;
      player.health -= amount;
      if (player.health <= 0) {
        player.health = 0;
        player.dead = true;
      }
    },
    heal(amount) {
      player.health = Math.min(PLAYER.health, player.health + amount);
    },
    update(dt, input, world, camYaw) {
      if (player.dead || player.car) return;
      const { forward, strafe } = input.axis();
      const run = input.down('ShiftLeft') || input.down('ShiftRight');
      const speed = run ? PLAYER.runSpeed : PLAYER.walkSpeed;
      // movement is relative to the camera yaw: forward is where the camera
      // looks, (sin yaw, cos yaw); screen-right is (-cos yaw, sin yaw)
      const sin = Math.sin(camYaw);
      const cos = Math.cos(camYaw);
      let mx = (forward * sin - strafe * cos) * speed;
      let mz = (forward * cos + strafe * sin) * speed;
      player.moving = Math.hypot(mx, mz) > 0.5;
      if (player.moving) {
        player.heading = Math.atan2(mx, mz);
        const nx = player.x + mx * dt;
        const nz = player.z + mz * dt;
        const fixed = world.collideCircle(nx, nz, PLAYER.radius);
        player.x = fixed.x;
        player.z = fixed.z;
        player.walkPhase += dt * speed * 1.6;
      }
      if (input.wasPressed('Space') && player.grounded) {
        player.vy = PLAYER.jumpSpeed;
        player.grounded = false;
      }
      if (!player.grounded) {
        player.vy -= 22 * dt;
        mesh.position.y += player.vy * dt;
        if (mesh.position.y <= 0) {
          mesh.position.y = 0;
          player.grounded = true;
          player.vy = 0;
        }
      }
      const swing = player.moving ? Math.sin(player.walkPhase) * 0.7 : 0;
      const L = mesh.userData.limbs;
      L.legL.rotation.x = swing;
      L.legR.rotation.x = -swing;
      L.armL.rotation.x = -swing * 0.8;
      L.armR.rotation.x = swing * 0.8;
      mesh.position.x = player.x;
      mesh.position.z = player.z;
      mesh.rotation.y = player.heading;
    },
    enterCar(car) {
      player.car = car;
      car.driver = 'player';
      mesh.visible = false;
      player.x = car.x;
      player.z = car.z;
    },
    exitCar() {
      if (!player.car) return null;
      const car = player.car;
      car.driver = null;
      player.car = null;
      const side = car.heading + Math.PI / 2;
      player.x = car.x + Math.sin(side) * 2.6;
      player.z = car.z + Math.cos(side) * 2.6;
      player.heading = car.heading;
      mesh.visible = true;
      mesh.position.set(player.x, 0, player.z);
      mesh.rotation.y = player.heading;
      return car;
    },
    syncFromCar() {
      if (player.car) {
        player.x = player.car.x;
        player.z = player.car.z;
        player.heading = player.car.heading;
      }
    },
  };
  return player;
}

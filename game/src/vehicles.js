// Vehicles: procedural low-poly cars (sedan, sports, SUV, truck, taxi, police),
// arcade driving physics, and the traffic that fills the streets.

import * as THREE from '../vendor/three.min.js';
import { CAR, CITY } from './config.js';
import { pick, range } from './random.js';

export const CAR_TYPES = {
  sedan: { name: 'Sedan', topSpeed: 0.8, accel: 0.9, length: 4.4, width: 1.9, height: 1.35, colors: [0x8a8f98, 0x3a4a6a, 0x6a3a3a, 0x2a2a2e, 0xb8b0a0] },
  sports: { name: 'Sports', topSpeed: 1.15, accel: 1.25, length: 4.2, width: 1.9, height: 1.1, colors: [0xd43a2a, 0x2a6ad4, 0xf2c94c, 0x20b8a0, 0xe8e8e8] },
  suv: { name: 'SUV', topSpeed: 0.72, accel: 0.8, length: 4.8, width: 2.0, height: 1.8, colors: [0x4a5a4a, 0x5a4a6a, 0x8a8f98, 0x2a2a2e] },
  truck: { name: 'Truck', topSpeed: 0.6, accel: 0.7, length: 5.4, width: 2.1, height: 2.0, colors: [0xc8c0b0, 0x6a7a8a, 0x8a6a4a] },
  taxi: { name: 'Taxi', topSpeed: 0.85, accel: 0.95, length: 4.4, width: 1.9, height: 1.4, colors: [0xf2c94c] },
  police: { name: 'CHPD Cruiser', topSpeed: 1.0, accel: 1.15, length: 4.5, width: 1.95, height: 1.35, colors: [0x1a2a4a] },
};

const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 12);
const wheelMat = new THREE.MeshLambertMaterial({ color: 0x151515 });
const glassMat = new THREE.MeshLambertMaterial({ color: 0x18222e });
const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
const tailMat = new THREE.MeshBasicMaterial({ color: 0xd42a2a });
const boxGeo = new THREE.BoxGeometry(1, 1, 1);

export function buildCarMesh(type, color) {
  const spec = CAR_TYPES[type];
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const body = new THREE.Mesh(boxGeo, bodyMat);
  body.scale.set(spec.width, spec.height * 0.62, spec.length);
  body.position.y = spec.height * 0.55;
  g.add(body);
  const cabin = new THREE.Mesh(boxGeo, glassMat);
  cabin.scale.set(spec.width * 0.86, spec.height * 0.5, spec.length * 0.48);
  cabin.position.set(0, spec.height * 1.02, -spec.length * 0.05);
  g.add(cabin);
  const roof = new THREE.Mesh(boxGeo, bodyMat);
  roof.scale.set(spec.width * 0.88, 0.12, spec.length * 0.5);
  roof.position.set(0, spec.height * 1.28, -spec.length * 0.05);
  g.add(roof);
  const wheels = [];
  for (const [wx, wz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx * (spec.width / 2 - 0.05), 0.38, wz * (spec.length / 2 - 0.75));
    g.add(wheel);
    wheels.push(wheel);
  }
  for (const s of [-1, 1]) {
    const head = new THREE.Mesh(boxGeo, lightMat);
    head.scale.set(0.45, 0.22, 0.08);
    head.position.set(s * (spec.width / 2 - 0.35), spec.height * 0.55, spec.length / 2 + 0.02);
    g.add(head);
    const tail = new THREE.Mesh(boxGeo, tailMat);
    tail.scale.set(0.45, 0.22, 0.08);
    tail.position.set(s * (spec.width / 2 - 0.35), spec.height * 0.55, -spec.length / 2 - 0.02);
    g.add(tail);
  }
  if (type === 'police') {
    const stripe = new THREE.Mesh(boxGeo, new THREE.MeshBasicMaterial({ color: 0xe8e8e8 }));
    stripe.scale.set(spec.width + 0.02, 0.3, spec.length * 0.9);
    stripe.position.y = spec.height * 0.62;
    g.add(stripe);
    const bar = new THREE.Mesh(boxGeo, new THREE.MeshBasicMaterial({ color: 0x2233ff }));
    bar.scale.set(1.2, 0.18, 0.3);
    bar.position.set(-0.3, spec.height * 1.42, -spec.length * 0.05);
    g.add(bar);
    const bar2 = new THREE.Mesh(boxGeo, new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    bar2.scale.set(1.2, 0.18, 0.3);
    bar2.position.set(0.3, spec.height * 1.42, -spec.length * 0.05);
    g.add(bar2);
    g.userData.lightbar = [bar, bar2];
  }
  if (type === 'taxi') {
    const sign = new THREE.Mesh(boxGeo, new THREE.MeshBasicMaterial({ color: 0xfff2b0 }));
    sign.scale.set(0.9, 0.22, 0.4);
    sign.position.set(0, spec.height * 1.42, -spec.length * 0.05);
    g.add(sign);
  }
  g.userData.wheels = wheels;
  return g;
}

export function createCar(scene, type, color, x, z, heading) {
  const mesh = buildCarMesh(type, color);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  scene.add(mesh);
  return {
    type,
    spec: CAR_TYPES[type],
    mesh,
    x, z, heading,
    speed: 0,
    steer: 0,
    damage: 0,
    hitCooldown: 0, // seconds until the next impact can add damage
    dead: false,
    driver: null, // 'player' | 'traffic' | 'police' | null (parked)
    updateVisual(dt) {
      mesh.position.set(this.x, 0, this.z);
      mesh.rotation.y = this.heading;
      const spin = (this.speed * dt) / 0.38;
      for (const w of mesh.userData.wheels) w.rotation.x += spin;
      const front = mesh.userData.wheels.slice(0, 2);
      for (const w of front) w.rotation.y = this.steer * 0.5;
      if (mesh.userData.lightbar) {
        const on = Math.floor(performance.now() / 180) % 2 === 0;
        mesh.userData.lightbar[0].material.color.setHex(on ? 0x2233ff : 0x0a0a2a);
        mesh.userData.lightbar[1].material.color.setHex(on ? 0x2a0a0a : 0xff2222);
      }
      // damage smoke
      if (this.damage > 0.55 && !this.dead) {
        mesh.position.y = 0;
      }
    },
    dispose() {
      scene.remove(mesh);
    },
  };
}

// --- arcade driving -----------------------------------------------------------
export function driveCar(car, input, dt, world, others) {
  const spec = car.spec;
  const top = CAR.maxSpeed * spec.topSpeed;
  car.hitCooldown = Math.max(0, car.hitCooldown - dt);
  if (input.forward > 0) car.speed += CAR.accel * spec.accel * dt;
  else if (input.forward < 0) {
    car.speed -= (car.speed > 0.5 ? CAR.brake : CAR.accel * 0.6) * dt;
  } else {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 6 * dt);
  }
  car.speed = Math.max(-CAR.reverseMax, Math.min(top, car.speed));
  const speedFactor = Math.min(1, Math.abs(car.speed) / 12);
  const targetSteer = input.strafe * CAR.steerMax * (1 - speedFactor * 0.45);
  car.steer += (targetSteer - car.steer) * Math.min(1, dt * 8);
  const handbrake = input.handbrake ? 1.6 : 1;
  // turn rate grows with speed but stays sane: ~0.2 rad/s crawling, ~1 rad/s flat out
  const turnRate = car.steer * (0.25 + Math.abs(car.speed) * 0.035) * handbrake;
  car.heading += turnRate * dt * (car.speed < 0 ? -1 : 1);
  const nx = car.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.z + Math.cos(car.heading) * car.speed * dt;
  const fixed = world.collideCircle(nx, nz, CAR.radius);
  if (Math.hypot(fixed.x - nx, fixed.z - nz) > 0.01) {
    car.speed *= 0.45; // building hit: scrub speed
    // damage once per impact, not once per frame of contact
    if (car.hitCooldown <= 0) {
      car.damage += 0.08;
      car.hitCooldown = 0.6;
    }
  }
  car.x = fixed.x;
  car.z = fixed.z;
  // soft collisions with other cars
  for (const o of others) {
    if (o === car || o.dead) continue;
    const dx = car.x - o.x;
    const dz = car.z - o.z;
    const d = Math.hypot(dx, dz);
    if (d < 4.4 && d > 0.01) {
      const push = (4.4 - d) / 2;
      car.x += (dx / d) * push;
      car.z += (dz / d) * push;
      car.speed *= 0.7;
      // damage once per impact, not once per frame of contact
      if (car.hitCooldown <= 0) {
        car.damage += 0.08;
        car.hitCooldown = 0.6;
      }
      if (o.hitCooldown <= 0) {
        o.damage += 0.05;
        o.hitCooldown = 0.6;
      }
    }
  }
  return car;
}

// --- traffic ------------------------------------------------------------------
export function createTraffic(scene, world, rand, count) {
  const cars = [];
  const types = ['sedan', 'sedan', 'suv', 'truck', 'taxi', 'sports'];
  function spawnCar(farFrom) {
    const vertical = rand() < 0.5;
    const street = pick(rand, world.streets);
    const along = range(rand, -CITY.bounds, CITY.bounds);
    const lane = pick(rand, [-1, 1]) * 4.5;
    const x = vertical ? street + lane : along;
    const z = vertical ? along : street + lane;
    if (farFrom && Math.hypot(x - farFrom.x, z - farFrom.z) < 60) return null;
    const type = pick(rand, types);
    const car = createCar(scene, type, pick(rand, CAR_TYPES[type].colors), x, z,
      vertical ? (lane > 0 ? 0 : Math.PI) : (lane > 0 ? Math.PI / 2 : -Math.PI / 2));
    car.driver = 'traffic';
    car.cruise = range(rand, 9, 15);
    car.vertical = vertical;
    car.street = street;
    car.lane = lane;
    cars.push(car);
    return car;
  }
  for (let i = 0; i < count; i++) spawnCar(null);

  function update(dt, playerPos, others) {
    for (const car of cars) {
      // drive along the street; slow down when something is ahead
      let ahead = Infinity;
      const fx = Math.sin(car.heading);
      const fz = Math.cos(car.heading);
      for (const o of others) {
        if (o === car) continue;
        const dx = o.x - car.x;
        const dz = o.z - car.z;
        const along = dx * fx + dz * fz;
        const side = Math.abs(dx * fz - dz * fx);
        if (along > 0 && along < 14 && side < 2.6) ahead = Math.min(ahead, along);
      }
      const target = ahead < 12 ? 0 : car.cruise;
      car.speed += (target - car.speed) * Math.min(1, dt * 2);
      car.x += fx * car.speed * dt;
      car.z += fz * car.speed * dt;
      // at the end of the street, turn onto a cross street or wrap
      const b = CITY.bounds - 10;
      if (Math.abs(car.x) > b || Math.abs(car.z) > b) {
        const vertical = rand() < 0.5;
        const street = pick(rand, world.streets);
        car.vertical = vertical;
        car.street = street;
        car.lane = pick(rand, [-1, 1]) * 4.5;
        car.x = vertical ? street + car.lane : range(rand, -b, b);
        car.z = vertical ? range(rand, -b, b) : street + car.lane;
        car.heading = vertical ? (car.lane > 0 ? 0 : Math.PI) : (car.lane > 0 ? Math.PI / 2 : -Math.PI / 2);
      }
      car.updateVisual(dt);
    }
    // keep traffic near the player: recycle cars that drifted far away
    if (playerPos) {
      for (const car of cars) {
        if (Math.hypot(car.x - playerPos.x, car.z - playerPos.z) > 320) {
          car.dispose();
          cars.splice(cars.indexOf(car), 1);
          spawnCar(playerPos);
          break;
        }
      }
    }
  }

  return { cars, update, spawnCar };
}

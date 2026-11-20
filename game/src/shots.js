// Screenshot scenes behind ?shot=cover|drive|combat|title. Each one plays the
// real game forward from a fresh seeded world for a fixed number of steps,
// steered by a small autopilot, so the frame is what real play looks like and
// the same seed always gives the same frame.

import * as THREE from '../vendor/three.min.js';
import { STEP } from './config.js';
import { createCar } from './vehicles.js';

// Steer a car along its current street: a lane-keeping controller that aims at
// the right-hand lane a short way ahead, so the car holds its lane at speed.
function driveAutopilot(game, car) {
  const dirs = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
  let base = dirs[0];
  let bd = Infinity;
  for (const d of dirs) {
    let dh = d - car.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    if (Math.abs(dh) < bd) { bd = Math.abs(dh); base = d; }
  }
  const street = game.world.nearestStreet(car.x, car.z);
  // right-hand lane: 4.5 units to the right of the direction of travel
  const rightX = -Math.cos(base);
  const rightZ = Math.sin(base);
  const laneX = street.vertical ? street.at + rightX * 4.5 : car.x;
  const laneZ = street.vertical ? car.z : street.at + rightZ * 4.5;
  const ePerp = (laneX - car.x) * rightX + (laneZ - car.z) * rightZ;
  let desired = base - Math.atan2(ePerp, 25);
  // avoid cars ahead: if something is in our lane within 35 units, steer
  // around it to the opposite side instead of rear-ending it
  const fx = Math.sin(car.heading);
  const fz = Math.cos(car.heading);
  const rx = -Math.cos(car.heading);
  const rz = Math.sin(car.heading);
  let obstacle = null;
  for (const other of [...game.traffic.cars, ...game.police.copCars]) {
    if (other === car || other.dead) continue;
    const dx = other.x - car.x;
    const dz = other.z - car.z;
    const along = dx * fx + dz * fz;
    const lat = dx * rx + dz * rz;
    if (along > 0 && along < 35 && Math.abs(lat) < 4.5) {
      if (!obstacle || along < obstacle.along) obstacle = { along, lat };
    }
  }
  if (obstacle) desired = base + (obstacle.lat > 0 ? 0.4 : -0.4);
  // near the end of a street, turn instead of leaving the city
  const aheadX = car.x + Math.sin(car.heading) * 40;
  const aheadZ = car.z + Math.cos(car.heading) * 40;
  if (Math.abs(aheadX) > 520 || Math.abs(aheadZ) > 520) desired = base + Math.PI / 2;
  let dh = desired - car.heading;
  while (dh > Math.PI) dh -= Math.PI * 2;
  while (dh < -Math.PI) dh += Math.PI * 2;
  return { forward: 1, strafe: Math.max(-1, Math.min(1, dh * 3)), handbrake: false };
}

function runSteps(game, seconds, driveFn) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i++) {
    if (driveFn) {
      const input = driveFn();
      game.stepGame(STEP, input);
    } else {
      game.stepGame(STEP, null);
    }
  }
}

export function stageShot(name, game) {
  const g = game;
  if (name === 'title') {
    // high orbit over downtown at sunset; the title screen DOM stays up
    g.camera.snapTo(54, 60, -120, Math.PI * 0.15);
    g.camera.camera.position.set(120, 90, -160);
    g.camera.camera.lookAt(0, 10, 60);
    return { screen: 'title' };
  }

  if (name === 'drive') {
    const car = createCar(g.scene, 'sports', 0xd43a2a, 54, -270, 0);
    car.driver = 'player';
    g.player.enterCar(car);
    g.player.money = 1250;
    runSteps(g, 5, () => driveAutopilot(g, car));
    return { screen: 'play' };
  }

  if (name === 'combat') {
    // on foot at the docks, mid-firefight: mission 4's kill step is live. The
    // player stands west of the dock palm so the sight line is clear, and the
    // Vultures are staged ahead in a firing line, one already down.
    g.player.x = 366;
    g.player.z = 480;
    g.player.heading = 0.3;
    g.player.mesh.position.set(366, 0, 480);
    g.player.giveWeapon('rifle');
    g.player.selectWeapon('rifle');
    g.player.money = 2400;
    g.missions.setCompleted(3);
    g.missions.startMission(g.ctx);
    g.police.setStars(2);
    g.peds.scare(378, 486, 60);
    g.camera.setYaw(0.3);
    g.camera.setPitch(0.35);
    runSteps(g, 1.0, null);
    // stage the firing line ahead of the player
    const spots = [[368, 498], [378, 506], [386, 496], [394, 508], [362, 510], [398, 494]];
    g.combat.enemies.forEach((e, i) => {
      const [sx, sz] = spots[i % spots.length];
      e.x = sx;
      e.z = sz;
      e.mesh.position.set(sx, 0, sz);
      e.heading = Math.atan2(g.player.x - sx, g.player.z - sz);
      e.mesh.rotation.y = e.heading;
    });
    // one Vulture down in the mid-ground, player back to full health
    const downed = g.combat.enemies[2];
    if (downed) {
      downed.health = 0;
      downed.dead = true;
      downed.mesh.rotation.x = Math.PI / 2;
      downed.mesh.position.y = 0.3;
    }
    g.player.health = 100;
    // a fresh muzzle flash right at capture time
    g.combat.shoot(
      new THREE.Vector3(366, 1.5, 480),
      g.camera.aimDirection(), 'rifle', [], g.world,
    );
    return { screen: 'play' };
  }

  // cover (default): a 3-star chase down the main drag, roadblock ahead,
  // helicopter overhead
  const car = createCar(g.scene, 'sports', 0x2a6ad4, 54, -200, 0);
  car.driver = 'player';
  g.player.enterCar(car);
  g.player.money = 4850;
  g.police.setStars(3);
  // start "The Getaway" so the HUD objective reads "Lose the cops"
  g.missions.setCompleted(4);
  g.missions.startMission(g.ctx);
  for (let i = 0; i < 3; i++) {
    const cop = createCar(g.scene, 'police', 0x1a2a4a, 54 + (i - 1) * 7, -200 - 26 - i * 14, 0);
    cop.driver = 'police';
    g.police.copCars.push(cop);
  }
  // roadblock parked ahead on the player's route (also blocks the random one)
  g.police.forceRoadblock({ x: 54, z: -45 }, 0);
  runSteps(g, 4, () => driveAutopilot(g, car));
  // back to 3 stars (a ped may have added one mid-run) so the HUD matches
  // the "Lose the cops (3 stars)" objective
  g.police.setStars(3);
  // helicopter staged above the street ahead, low enough to sit in the frame
  g.police.placeHeli(car.x + 10, 26, car.z + 60);
  return { screen: 'play' };
}

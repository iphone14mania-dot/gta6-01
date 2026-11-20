// Coral Harbor — main entry. Boots the renderer and every system, runs the
// fixed-step game loop, wires input to the player, and owns the screens
// (title, play, pause, wasted, busted, mission complete).

import * as THREE from '../vendor/three.min.js';
import { STEP, PLACES, WEAPON_ORDER } from './config.js';
import { createRandom } from './random.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createWorld } from './world.js';
import { createCar, createTraffic, driveCar } from './vehicles.js';
import { createPedestrians } from './pedestrians.js';
import { createPlayer } from './player.js';
import { createCombat, createParticles } from './combat.js';
import { createPolice } from './police.js';
import { createMissions } from './missions.js';
import { createCamera } from './camera.js';
import { createHud } from './hud.js';
import { saveGame, loadGame, applySave } from './save.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const SEED = Number(params.get('seed') || 1);
const SHOT = params.get('shot');
const rand = createRandom(SEED);

// --- renderer / scene ----------------------------------------------------------
const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
app.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2e1a4d);

// --- systems -------------------------------------------------------------------
const world = createWorld(scene, SEED);
const input = createInput();
input.attach(renderer.domElement);
const audio = createAudio();
const particles = createParticles(scene);
const traffic = createTraffic(scene, world, rand, 26);
const peds = createPedestrians(scene, world, rand, 40);
const player = createPlayer(scene, PLACES.garage.x + 6, PLACES.garage.z + 6);
const combat = createCombat(scene, rand, audio, particles);
const police = createPolice(scene, world, rand, audio);
const missions = createMissions(scene, rand);
const cam = createCamera();
const hud = createHud(world);
const garageCars = [];

// starter car parked by the garage
const starter = createCar(scene, 'sedan', 0x3a4a6a, PLACES.garage.x + 10, PLACES.garage.z + 2, Math.PI / 2);
starter.driver = null;

// saved progress, if any
const saved = loadGame();
if (saved) {
  applySave(saved, player, missions);
  for (const g of saved.garage || []) {
    const c = createCar(scene, g.type, 0x8a8f98, g.x, g.z, g.heading);
    c.driver = null;
    garageCars.push(c);
  }
}

// --- screens -------------------------------------------------------------------
const screens = {
  title: document.getElementById('screen-title'),
  pause: document.getElementById('screen-pause'),
  over: document.getElementById('screen-over'),
  complete: document.getElementById('screen-complete'),
};
const overTitle = document.getElementById('over-title');
const overBody = document.getElementById('over-body');
const completeTitle = document.getElementById('complete-title');
const completeBody = document.getElementById('complete-body');
let screen = 'title'; // title | play | pause | over
let frozen = false; // screenshot mode: staged and held still
let lastDamageAt = -100;
let elapsed = 0;

function showScreen(name) {
  screen = name;
  for (const [key, el] of Object.entries(screens)) {
    el.classList.toggle('show', key === name);
  }
  document.getElementById('hud').classList.toggle('hidden', name !== 'play');
}

const ctx = {
  player, police, combat, audio,
  onMessage: (t, b) => hud.toast(t, b),
  onMissionComplete: (def) => {
    completeTitle.textContent = `Job complete: ${def.title}`;
    completeBody.textContent = `+$${def.reward.toLocaleString('en-US')} · +${def.respect} respect${def.unlock ? ` · ${def.unlock.toUpperCase()} unlocked` : ''}`;
    screens.complete.classList.add('show');
    setTimeout(() => screens.complete.classList.remove('show'), 4200);
    saveGame(player, missions, garageCars);
    hud.toast('Job complete', `${def.title} — $${def.reward} earned.`);
  },
  onMissionFail: (def, reason) => {
    hud.toast('Job failed', reason || 'Try again — drive back to the marker.');
  },
  onKeepCar: (car) => {
    garageCars.push(car);
    hud.toast('Garage', 'The Comet GT is yours now. It is parked at the garage.');
    saveGame(player, missions, garageCars);
  },
};

// --- the game object the screenshot scenes drive -------------------------------
const game = {
  scene, world, rand, input, audio, traffic, peds, player, combat, police,
  missions, camera: cam, ctx,
  stepGame(dt, driveOverride) {
    step(dt, driveOverride);
  },
};

function nearestCar(x, z, maxDist) {
  let best = null;
  let bd = maxDist;
  const all = [...traffic.cars, ...police.copCars, starter, ...garageCars];
  if (missions.active && missions.active.targetCar) all.push(missions.active.targetCar);
  for (const c of all) {
    if (c.dead) continue;
    const d = Math.hypot(c.x - x, c.z - z);
    if (d < bd) {
      bd = d;
      best = c;
    }
  }
  return best;
}

function enterNearestCar() {
  const car = nearestCar(player.x, player.z, 5.5);
  if (!car) return;
  if (car.driver === 'traffic') {
    player.stats.carsStolen += 1;
    const copNear = police.copCars.some((c) => Math.hypot(c.x - player.x, c.z - player.z) < 70);
    if (copNear || police.stars > 0) police.addStars(1);
    traffic.cars.splice(traffic.cars.indexOf(car), 1);
    hud.toast('Car stolen', `${car.spec.name} — yours now.`);
  }
  if (car.type === 'police') police.addStars(2);
  player.enterCar(car);
  audio.startEngine();
}

function explodeCar(car) {
  particles.explosion(car.x, 1, car.z);
  audio.explosion();
  car.dead = true;
  if (player.car === car) {
    player.exitCar();
    player.hurt(35);
    lastDamageAt = elapsed;
  }
  if (car.driver === 'traffic') {
    const i = traffic.cars.indexOf(car);
    if (i !== -1) traffic.cars.splice(i, 1);
  }
  car.dispose();
  peds.scare(car.x, car.z, 50);
}

function respawn(afterBust) {
  player.health = 100;
  player.dead = false;
  player.money = Math.max(0, Math.floor(player.money * 0.9));
  police.clearAll();
  if (player.car) {
    player.car.driver = null;
    player.car = null;
    player.mesh.visible = true;
  }
  player.x = PLACES.safehouse.x;
  player.z = PLACES.safehouse.z;
  player.mesh.position.set(player.x, 0, player.z);
  cam.snapTo(player.x, 1.2, player.z, Math.PI);
  if (missions.active) missions.fail(ctx, afterBust ? 'Busted by the CHPD.' : 'Wasted.');
  showScreen('play');
}

// --- one fixed simulation step ---------------------------------------------------
function step(dt, driveOverride) {
  elapsed += dt;
  const firing = input.firing() && !player.car && !player.dead;

  // --- player ---
  if (player.car) {
    const car = player.car;
    const axis = driveOverride || input.axis();
    const driveInput = {
      forward: axis.forward,
      strafe: axis.strafe,
      handbrake: input.down('Space'),
    };
    driveCar(car, driveInput, dt, world, [...traffic.cars, ...police.copCars]);
    car.updateVisual(dt);
    player.syncFromCar();
    player.stats.distanceDriven += Math.abs(car.speed) * dt;
    audio.setEngine(Math.min(1, Math.abs(car.speed) / 40), true);
    // run over peds
    for (const ped of peds.peds) {
      if (ped.state !== 'down' && Math.hypot(ped.x - car.x, ped.z - car.z) < 2.4 && Math.abs(car.speed) > 4) {
        peds.knockDown(ped);
        police.addStars(1);
        audio.crash();
      }
    }
    if (car.damage > 1) explodeCar(car);
  } else {
    const look = input.consumeMouse();
    cam.addLook(look.dx, look.dy);
    if (firing) player.heading = cam.yaw;
    player.update(dt, input, world, cam.yaw);
    audio.setEngine(0, false);
  }

  // --- shooting ---
  if (firing && !player.dead) {
    const targets = [...combat.enemies.map((e) => e.mesh), world.group];
    const hit = combat.tryFire(player, cam.aimDirection(), targets, world);
    if (hit && police.stars === 0) police.addStars(1);
    if (hit) peds.scare(player.x, player.z, 60);
  }
  if (input.wasPressed('KeyR')) combat.reload(player);
  for (let i = 0; i < WEAPON_ORDER.length; i++) {
    if (input.wasPressed(`Digit${i + 1}`)) player.selectWeapon(WEAPON_ORDER[i]);
  }

  // --- enter / exit car ---
  if (input.wasPressed('KeyE')) {
    if (player.car) {
      const car = player.exitCar();
      audio.stopEngine();
      // parked at the garage? it joins the collection
      if (car && Math.hypot(car.x - PLACES.garage.x, car.z - PLACES.garage.z) < 22 && !garageCars.includes(car)) {
        garageCars.push(car);
        hud.toast('Garage', `${car.spec.name} stored. It will be here when you come back.`);
        saveGame(player, missions, garageCars);
      }
    } else {
      enterNearestCar();
    }
  }

  // --- world systems ---
  traffic.update(dt, player, [...traffic.cars, ...police.copCars, ...(player.car ? [player.car] : [])]);
  peds.update(dt, player);
  combat.update(dt, player, world, (dmg) => {
    player.hurt(dmg);
    lastDamageAt = elapsed;
  });
  police.update(dt, player, world, traffic.cars, () => {
    overTitle.textContent = 'BUSTED';
    overBody.textContent = 'The CHPD caught up with you. $' + Math.floor(player.money * 0.1).toLocaleString('en-US') + ' in fines.';
    showScreen('over');
  });
  missions.update(dt, ctx);
  particles.update(dt);
  world.update();

  // slow health regen out of combat
  if (!player.dead && elapsed - lastDamageAt > 10 && player.health < 100) {
    player.heal(3 * dt);
  }

  // camera + HUD
  const target = player.car
    ? { x: player.car.x, y: 1.5, z: player.car.z, heading: player.car.heading }
    : { x: player.x, y: 1.2, z: player.z, heading: player.heading };
  cam.update(dt, target, !!player.car, player.car ? Math.min(1, Math.abs(player.car.speed) / 40) : 0);
  hud.update({ player, police, mission: missions, audio, trafficCars: traffic.cars });

  if (player.dead && screen === 'play') {
    overTitle.textContent = 'WASTED';
    overBody.textContent = 'Milo went down. The harbor keeps moving without him.';
    showScreen('over');
  }
  input.endFrame();
}

// --- main loop -------------------------------------------------------------------
let last = performance.now();
let acc = 0;
function loop(now) {
  requestAnimationFrame(loop);
  if (frozen) return;
  const frame = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (screen === 'play') {
    acc += frame;
    while (acc >= STEP) {
      step(STEP, null);
      acc -= STEP;
    }
  }
  renderer.render(scene, cam.camera);
}

function resize() {
  cam.camera.aspect = window.innerWidth / window.innerHeight;
  cam.camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', resize);

// --- UI wiring -------------------------------------------------------------------
document.getElementById('btn-start').addEventListener('click', () => {
  audio.unlock();
  audio.startRadio();
  showScreen('play');
  input.lockPointer(renderer.domElement);
  cam.snapTo(player.x, 1.2, player.z, Math.PI);
  hud.toast('Coral Harbor', 'Drive to the yellow marker to start your first job. WASD to move, E to enter a car.');
});
document.getElementById('btn-continue').addEventListener('click', () => {
  respawn(overTitle.textContent === 'BUSTED');
});
document.getElementById('btn-resume').addEventListener('click', () => {
  showScreen('play');
  input.lockPointer(renderer.domElement);
});
document.getElementById('btn-save').addEventListener('click', () => {
  saveGame(player, missions, garageCars);
  hud.toast('Saved', 'Progress saved in this browser.');
});
document.getElementById('btn-restart').addEventListener('click', () => {
  window.location.reload();
});
document.getElementById('btn-title').addEventListener('click', () => {
  showScreen('title');
  if (document.pointerLockElement) document.exitPointerLock();
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' && screen === 'play') {
    showScreen('pause');
    if (document.pointerLockElement) document.exitPointerLock();
  } else if (e.code === 'Escape' && screen === 'pause') {
    showScreen('play');
    input.lockPointer(renderer.domElement);
  }
  if (e.code === 'KeyM') {
    const muted = audio.toggleMute();
    hud.toast(muted ? 'Muted' : 'Sound on', muted ? 'Press M to unmute.' : audio.stationName);
  }
  if (e.code === 'KeyQ' && screen === 'play') {
    hud.toast('Radio', audio.nextStation());
  }
  if (e.code === 'KeyP' && screen === 'play') {
    saveGame(player, missions, garageCars);
    hud.toast('Saved', 'Progress saved in this browser.');
  }
});
renderer.domElement.addEventListener('click', () => {
  if (screen === 'play' && !input.pointerLocked) input.lockPointer(renderer.domElement);
});

// --- boot ------------------------------------------------------------------------
cam.snapTo(player.x, 1.2, player.z, Math.PI);
renderer.render(scene, cam.camera);

if (SHOT) {
  // Screenshot mode: stage the scene, render it, hold still for capture.
  showScreen('play');
  const result = stageShot(SHOT, game);
  if (result.screen === 'title') {
    showScreen('title');
  } else {
    hud.update({ player, police, mission: missions, audio, trafficCars: traffic.cars });
    cam.update(0.016, player.car
      ? { x: player.car.x, y: 1.5, z: player.car.z, heading: player.car.heading }
      : { x: player.x, y: 1.2, z: player.z, heading: player.heading },
    !!player.car, player.car ? Math.min(1, Math.abs(player.car.speed) / 40) : 0);
  }
  hud.dismissToast();
  renderer.render(scene, cam.camera);
  frozen = true;
  window.__shotReady = true;
} else {
  showScreen('title');
  requestAnimationFrame(loop);
}

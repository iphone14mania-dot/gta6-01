// The world: one state object, built from a seed, advanced in fixed steps.
// Every subsystem gets its turn here, in a fixed order, so a replayed input
// stream replays the same game. Pure logic only — no DOM — so the Node
// integration test imports this module directly.

import { createRandom } from './random.js';
import { buildCity } from './city.js';
import { spawnTraffic, updateCars, drivePlayerCar } from './vehicles.js';
import { spawnPeds, updatePeds } from './pedestrians.js';
import { createPlayer, movePlayerOnFoot, updateBullets, updatePlayer } from './player.js';
import { createPolice, updatePolice } from './police.js';
import { updateMission, updateRivals } from './missions.js';
import { collectPackages, updateTaxi } from './activities.js';

export const EVENT_NONE = 0;
export const EVENT_WASTED = 1;
export const EVENT_BUSTED = 2;
export const EVENT_MISSION_PASSED = 4;
export const EVENT_MISSION_FAILED = 8;

/** Build a fresh world from a seed. */
export function createWorld(seed) {
  const rng = createRandom(seed);
  const city = buildCity(rng);
  const state = {
    seed,
    rng,
    time: 0,
    city,
    player: createPlayer(city.start),
    cars: [],
    peds: [],
    rivals: [],
    bullets: [],
    particles: [],
    skids: [],
    police: createPolice(),
    mission: null,
    taxi: null,
    upgrades: { engine: 0, armor: 0 },
    crew: {},
    stats: { missionsDone: 0, earned: 0, kills: 0, fares: 0, carsStolen: 0, packages: 0 },
    effects: { shake: 0, flash: 0, muzzle: 0 },
    camera: { x: city.start.x, y: city.start.y },
    notice: '',
    noticeTimer: 0,
  };
  state.cars = spawnTraffic(city, rng);
  state.peds = spawnPeds(city, rng);
  return state;
}

/** Reset the world to a fresh run with the same seed. */
export function resetWorld(state) {
  const fresh = createWorld(state.seed);
  for (const key of Object.keys(fresh)) state[key] = fresh[key];
}

/** A short-lived notice line for the HUD ("Mission passed +$300"). */
export function notify(state, text) {
  state.notice = text;
  state.noticeTimer = 3.5;
}

function updateParticles(state, dt) {
  for (const pt of state.particles) {
    pt.life -= dt;
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= 1 - 1.5 * dt;
    pt.vy *= 1 - 1.5 * dt;
  }
  state.particles = state.particles.filter((pt) => pt.life > 0);
  for (const s of state.skids) s.life -= dt;
  state.skids = state.skids.filter((s) => s.life > 0);
  state.effects.shake = Math.max(0, state.effects.shake - 30 * dt);
  state.effects.flash = Math.max(0, state.effects.flash - dt);
  state.effects.muzzle = Math.max(0, state.effects.muzzle - dt);
  if (state.noticeTimer > 0) state.noticeTimer -= dt;
}

/** Advance the world one fixed step. `input` is the snapshot from input.js. */
export function stepWorld(state, dt, input) {
  state.time += dt;
  const p = state.player;

  if (p.alive && !p.busted) {
    if (p.onFoot) {
      movePlayerOnFoot(state, input, dt);
      if (input.firing) {
        // Firing is handled by main.js through fireWeapon (needs the aim point).
      }
    } else {
      const car = state.cars.find((c) => c.id === p.inCar);
      if (car) {
        drivePlayerCar(state, car, input, dt);
        p.x = car.x;
        p.y = car.y;
        p.angle = car.angle;
      } else {
        p.onFoot = true;
        p.inCar = null;
      }
    }
  }

  updateCars(state, dt);
  updatePeds(state, dt);
  updateBullets(state, dt);
  updateRivals(state, dt);
  updatePolice(state, dt);
  updatePlayer(state, dt);
  collectPackages(state);
  updateTaxi(state, dt);
  updateParticles(state, dt);

  // Camera follows the player with a look-ahead in the direction of travel.
  const car = state.cars.find((c) => c.id === p.inCar);
  const lookX = car ? Math.cos(car.angle) * Math.min(Math.abs(car.speed) * 0.25, 90) : 0;
  const lookY = car ? Math.sin(car.angle) * Math.min(Math.abs(car.speed) * 0.25, 90) : 0;
  const tx = p.x + lookX;
  const ty = p.y + lookY;
  const k = 1 - Math.pow(0.0015, dt);
  state.camera.x += (tx - state.camera.x) * k;
  state.camera.y += (ty - state.camera.y) * k;

  let events = EVENT_NONE;
  const missionResult = updateMission(state, dt);
  if (missionResult === 'passed') events |= EVENT_MISSION_PASSED;
  if (missionResult === 'failed') events |= EVENT_MISSION_FAILED;
  if (!p.alive && p.busted) events |= EVENT_BUSTED;
  else if (!p.alive) events |= EVENT_WASTED;
  return events;
}

/** Snap the camera straight onto the player (screenshot staging). */
export function snapCamera(state) {
  state.camera.x = state.player.x;
  state.camera.y = state.player.y;
}

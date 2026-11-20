// The Solmar Bay Police Department: a five-star wanted system. Heat rises
// with crime and cools when the player stays unseen; foot cops, patrol cars,
// roadblocks (3 stars and up) and the Air One helicopter (4 stars and up)
// respond to the level. Caught on foot at low speed means busted.

import { WANTED } from './config.js';
import { angleDiff, clamp, dist } from './random.js';
import { AVENUES, STREETS, ROAD_WIDTH } from './config.js';
import { buildingHit, clampToWorld, isOnRoad } from './city.js';
import { makeCar, moveCar } from './vehicles.js';
import { damagePlayer } from './player.js';

export function createPolice() {
  return {
    heat: 0,
    wanted: 0,
    foot: [],
    heli: null,
    roadblocks: [],
    lastSeen: 0,
    spawnTimer: 0,
    bustTimer: 0,
  };
}

/** Wanted stars from heat: 0 below 1, then one star per 1.2 heat, capped at 5. */
export function wantedFromHeat(heat) {
  if (heat < 1) return 0;
  return clamp(1 + Math.floor((heat - 1) / 1.2), 1, WANTED.max);
}

/** Can any cop currently see the player? (range + no building between). */
export function policeCanSee(state) {
  const p = state.player;
  const eyes = [];
  for (const cop of state.police.foot) if (cop.alive) eyes.push(cop);
  for (const car of state.cars) if (car.driver === 'police') eyes.push(car);
  if (state.police.heli) eyes.push(state.police.heli);
  for (const e of eyes) {
    const d = dist(p.x, p.y, e.x, e.y);
    const range = e === state.police.heli ? 900 : 560;
    if (d < range) {
      // Buildings block sight for ground units, never for the helicopter.
      if (e === state.police.heli) return true;
      let blocked = false;
      const steps = Math.ceil(d / 20);
      for (let i = 1; i < steps; i += 1) {
        const t = i / steps;
        if (buildingHit(state.city, p.x + (e.x - p.x) * t, p.y + (e.y - p.y) * t, 2)) { blocked = true; break; }
      }
      if (!blocked) return true;
    }
  }
  return false;
}

function spawnFootCop(state) {
  const p = state.player;
  const a = state.rng.range(0, Math.PI * 2);
  const r = state.rng.range(240, 420);
  let x = p.x + Math.cos(a) * r;
  let y = p.y + Math.sin(a) * r;
  const c = clampToWorld(x, y);
  x = c.x; y = c.y;
  if (buildingHit(state.city, x, y, 12)) return;
  state.police.foot.push({ x, y, angle: 0, health: 50, alive: true, shootTimer: state.rng.range(0.3, 1) });
}

function spawnPatrolCar(state) {
  const p = state.player;
  // On the nearest road, a little ahead of the player's direction of travel.
  const vertical = state.rng.chance(0.5);
  const road = vertical ? AVENUES[Math.floor(state.rng.next() * AVENUES.length)] : STREETS[Math.floor(state.rng.next() * STREETS.length)];
  const along = vertical ? p.y + state.rng.range(-500, 500) : p.x + state.rng.range(-500, 500);
  const x = vertical ? road : clamp(along, 400, 3500);
  const y = vertical ? clamp(along, 150, 2550) : road;
  if (!isOnRoad(x, y)) return;
  const car = makeCar(x, y, state.rng.range(0, Math.PI * 2), 'sedan', '#1565c0', 'police');
  car.siren = true;
  car.speed = 200;
  state.cars.push(car);
}

function spawnRoadblock(state) {
  const p = state.player;
  const car = state.cars.find((c) => c.id === p.inCar);
  const heading = car ? car.angle : p.angle;
  const bx = p.x + Math.cos(heading) * 420;
  const by = p.y + Math.sin(heading) * 420;
  if (!isOnRoad(bx, by)) return;
  state.police.roadblocks.push({ x: bx, y: by, angle: heading + Math.PI / 2, life: 30 });
}

function updateHeli(state, dt) {
  const heli = state.police.heli;
  if (!heli) return;
  const p = state.player;
  const want = Math.atan2(p.y - heli.y, p.x - heli.x);
  heli.angle += clamp(angleDiff(heli.angle, want), -1.4 * dt, 1.4 * dt);
  const d = dist(heli.x, heli.y, p.x, p.y);
  const speed = d > 260 ? 320 : 140;
  heli.x += Math.cos(heli.angle) * speed * dt;
  heli.y += Math.sin(heli.angle) * speed * dt;
  heli.rotor = (heli.rotor || 0) + dt * 30;
  // The helicopter's searchlight keeps the player "seen" while it hovers close.
  if (d < 700) state.police.lastSeen = 0;
}

function updateFootCops(state, dt) {
  const p = state.player;
  for (const cop of state.police.foot) {
    if (!cop.alive) continue;
    const d = dist(cop.x, cop.y, p.x, p.y);
    const want = Math.atan2(p.y - cop.y, p.x - cop.x);
    cop.angle += clamp(angleDiff(cop.angle, want), -4 * dt, 4 * dt);
    const speed = d > 60 ? 200 : 0;
    const nx = cop.x + Math.cos(cop.angle) * speed * dt;
    const ny = cop.y + Math.sin(cop.angle) * speed * dt;
    if (!buildingHit(state.city, nx, ny, 11)) {
      const c = clampToWorld(nx, ny);
      cop.x = c.x; cop.y = c.y;
    }
    // Cops shoot when close; they bust the player when adjacent and slow.
    cop.shootTimer -= dt;
    if (d < 420 && cop.shootTimer <= 0 && p.onFoot) {
      cop.shootTimer = 0.9 + state.rng.range(0, 0.7);
      const spread = state.rng.range(-0.12, 0.12);
      state.bullets.push({
        x: cop.x, y: cop.y,
        vx: Math.cos(want + spread) * 800, vy: Math.sin(want + spread) * 800,
        life: 0.7, damage: 9, from: 'cop',
      });
    }
    if (d < 34 && p.onFoot && state.player.alive) {
      state.police.bustTimer += dt;
      if (state.police.bustTimer > 1.6) {
        p.busted = true;
        p.alive = false;
      }
    } else if (d > 60) {
      state.police.bustTimer = Math.max(0, state.police.bustTimer - dt);
    }
  }
  state.police.foot = state.police.foot.filter((c) => c.alive || dist(c.x, c.y, p.x, p.y) < 900);
}

function updatePatrolCars(state, dt) {
  const p = state.player;
  const playerCar = state.cars.find((c) => c.id === p.inCar);
  const target = playerCar || p;
  for (const car of state.cars) {
    if (car.driver !== 'police' || car.wrecked) continue;
    const d = dist(car.x, car.y, target.x, target.y);
    const want = Math.atan2(target.y - car.y, target.x - car.x);
    car.angle += clamp(angleDiff(car.angle, want), -2.4 * dt, 2.4 * dt);
    const wantSpeed = d > 120 ? 560 : 260;
    car.speed += clamp(wantSpeed - car.speed, -500 * dt, 420 * dt);
    moveCar(state, car, dt);
    // Ramming the player's car hurts it.
    if (playerCar && d < 46) {
      playerCar.health -= 14 * dt;
      if (playerCar.health <= 0) damagePlayer(state, 12 * dt);
    }
  }
}

/** Main police update: wanted level, spawns, pursuit, cooldown. */
export function updatePolice(state, dt) {
  const pol = state.police;
  pol.wanted = wantedFromHeat(pol.heat);
  if (pol.wanted === 0) {
    pol.foot = [];
    pol.heli = null;
    pol.roadblocks = [];
    for (const car of state.cars) if (car.driver === 'police') car.driver = 'none';
    return;
  }
  const seen = policeCanSee(state);
  if (seen) pol.lastSeen = 0;
  else pol.lastSeen += dt;

  // Heat cools once the player has been unseen for a while.
  if (pol.lastSeen > WANTED.decayDelay) {
    const rate = WANTED.decayRate * (state.crew.driver ? 1.3 : 1);
    pol.heat = Math.max(0, pol.heat - rate * dt);
  }

  // Reinforcements arrive over time, scaled by the wanted level.
  pol.spawnTimer -= dt;
  if (pol.spawnTimer <= 0) {
    pol.spawnTimer = 2.2;
    const wantFoot = Math.min(2 + pol.wanted, 7);
    const wantCars = Math.min(pol.wanted - 1, 4);
    if (pol.foot.filter((c) => c.alive).length < wantFoot) spawnFootCop(state);
    if (state.cars.filter((c) => c.driver === 'police' && !c.wrecked).length < Math.max(wantCars, 0)) spawnPatrolCar(state);
    if (pol.wanted >= 3 && pol.roadblocks.length < 2 && state.rng.chance(0.5)) spawnRoadblock(state);
  }
  if (pol.wanted >= 4 && !pol.heli) {
    pol.heli = { x: state.player.x - 400, y: state.player.y - 400, angle: 0, rotor: 0 };
  }
  if (pol.wanted < 4) pol.heli = null;

  for (const rb of pol.roadblocks) rb.life -= dt;
  pol.roadblocks = pol.roadblocks.filter((rb) => rb.life > 0);

  updateFootCops(state, dt);
  updatePatrolCars(state, dt);
  updateHeli(state, dt);
}

/** Clear all heat (garage respray, mission reward, busted). */
export function clearWanted(state) {
  state.police.heat = 0;
  state.police.wanted = 0;
  state.police.foot = [];
  state.police.heli = null;
  state.police.roadblocks = [];
  state.police.bustTimer = 0;
  for (const car of state.cars) if (car.driver === 'police') car.driver = 'none';
}

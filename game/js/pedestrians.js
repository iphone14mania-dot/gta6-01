// Pedestrians: forty-odd locals who stroll the sidewalks, wait at corners,
// and scatter when gunfire or an explosion goes off near them.

import { AVENUES, STREETS, ROAD_WIDTH, PED_COUNT, WORLD } from './config.js';
import { dist } from './random.js';
import { buildingHit, clampToWorld } from './city.js';

const SHIRTS = ['#e57373', '#64b5f6', '#81c784', '#ffd54f', '#ba68c8', '#4db6ac', '#ff8a65', '#a1887f'];

export function spawnPeds(city, rng) {
  const peds = [];
  let guard = 0;
  while (peds.length < PED_COUNT && guard < 900) {
    guard += 1;
    // Sidewalk spots: just off a road, never inside a building.
    const vertical = rng.chance(0.5);
    const x = vertical
      ? rng.pick(AVENUES) + ROAD_WIDTH / 2 + rng.range(6, 26) * (rng.chance(0.5) ? 1 : -1)
      : rng.range(380, WORLD.width - 60);
    const y = vertical
      ? rng.range(120, WORLD.height - 120)
      : rng.pick(STREETS) + ROAD_WIDTH / 2 + rng.range(6, 26) * (rng.chance(0.5) ? 1 : -1);
    if (x < WORLD.seaWidth + WORLD.sandWidth + 4) continue;
    if (buildingHit(city, x, y, 10)) continue;
    peds.push({
      x, y,
      angle: rng.range(0, Math.PI * 2),
      speed: rng.range(38, 70),
      shirt: rng.pick(SHIRTS),
      state: 'walk',
      tx: x, ty: y,
      wait: rng.range(0, 4),
      panic: 0,
    });
  }
  return peds;
}

/** Frighten every pedestrian within range of (x, y): they run from the noise. */
export function scarePeds(state, x, y, range) {
  for (const ped of state.peds) {
    if (dist(ped.x, ped.y, x, y) < range) {
      ped.state = 'flee';
      ped.panic = 4 + state.rng.range(0, 3);
      const a = Math.atan2(ped.y - y, ped.x - x) + state.rng.range(-0.5, 0.5);
      ped.tx = ped.x + Math.cos(a) * 320;
      ped.ty = ped.y + Math.sin(a) * 320;
    }
  }
}

function pickStrollTarget(state, ped) {
  // Wander toward a nearby road, then along it.
  const vertical = state.rng.chance(0.5);
  const x = vertical
    ? AVENUES[Math.floor(state.rng.next() * AVENUES.length)] + ROAD_WIDTH / 2 + 14
    : ped.x + state.rng.range(-260, 260);
  const y = vertical
    ? ped.y + state.rng.range(-260, 260)
    : STREETS[Math.floor(state.rng.next() * STREETS.length)] + ROAD_WIDTH / 2 + 14;
  ped.tx = x;
  ped.ty = y;
}

export function updatePeds(state, dt) {
  for (const ped of state.peds) {
    if (ped.state === 'flee') {
      ped.panic -= dt;
      if (ped.panic <= 0) ped.state = 'walk';
    } else if (ped.wait > 0) {
      ped.wait -= dt;
      continue;
    }
    const d = dist(ped.x, ped.y, ped.tx, ped.ty);
    if (d < 14) {
      if (ped.state === 'flee') { ped.state = 'walk'; ped.wait = state.rng.range(1, 5); }
      else { pickStrollTarget(state, ped); ped.wait = state.rng.chance(0.3) ? state.rng.range(1, 4) : 0; }
      continue;
    }
    const targetAngle = Math.atan2(ped.ty - ped.y, ped.tx - ped.x);
    let da = targetAngle - ped.angle;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    ped.angle += Math.max(-3 * dt, Math.min(3 * dt, da));
    const speed = ped.state === 'flee' ? ped.speed * 2.6 : ped.speed;
    const nx = ped.x + Math.cos(ped.angle) * speed * dt;
    const ny = ped.y + Math.sin(ped.angle) * speed * dt;
    if (!buildingHit(state.city, nx, ny, 10)) {
      const p = clampToWorld(nx, ny);
      ped.x = p.x;
      ped.y = p.y;
    } else {
      pickStrollTarget(state, ped);
    }
  }
}

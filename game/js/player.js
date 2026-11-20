// Leo Marlow on foot: movement, aiming, three switchable weapons, bullets
// that stop at walls, health and armour, and the cash/respect he earns.

import { PLAYER, WEAPONS, WANTED } from './config.js';
import { clamp, dist } from './random.js';
import { buildingHit, clampToWorld, pushOutOfBuildings, segmentBlocked } from './city.js';
import { scarePeds } from './pedestrians.js';
import { spawnSmoke } from './vehicles.js';

export function createPlayer(start) {
  return {
    x: start.x, y: start.y, angle: -Math.PI / 2,
    onFoot: true, inCar: null,
    health: PLAYER.maxHealth, armor: 0,
    cash: 250, respect: 0,
    weapon: 'pistol',
    weapons: {
      pistol: { ammo: 48, mag: 12 },
      smg: { ammo: 0, mag: 0 },
      shotgun: { ammo: 0, mag: 0 },
    },
    cooldown: 0,
    reload: 0,
    aimX: start.x, aimY: start.y - 100,
    alive: true,
    busted: false,
  };
}

/** Which weapons has the player unlocked (by missions completed)? */
export function unlockedWeapons(state) {
  const done = state.stats.missionsDone;
  return Object.keys(WEAPONS).filter((w) => WEAPONS[w].unlock <= done);
}

/** Switch to the next unlocked weapon. */
export function cycleWeapon(state) {
  const list = unlockedWeapons(state);
  const i = list.indexOf(state.player.weapon);
  state.player.weapon = list[(i + 1) % list.length];
}

export function giveAmmo(state, weapon, rounds) {
  const w = state.player.weapons[weapon];
  if (w) w.ammo += rounds;
}

/** Fire the current weapon toward the aim point. Returns true if a shot left. */
export function fireWeapon(state) {
  const p = state.player;
  if (!p.onFoot || !p.alive || p.cooldown > 0 || p.reload > 0) return false;
  const def = WEAPONS[p.weapon];
  const slot = p.weapons[p.weapon];
  if (slot.mag <= 0) {
    if (slot.ammo > 0) p.reload = p.weapon === 'shotgun' ? 1.6 : 1.1;
    return false;
  }
  slot.mag -= 1;
  p.cooldown = def.rate;
  p.angle = Math.atan2(p.aimY - p.y, p.aimX - p.x);
  const pellets = def.pellets || 1;
  for (let i = 0; i < pellets; i += 1) {
    const spread = (state.rng.next() - 0.5) * 2 * def.spread;
    const a = p.angle + spread;
    state.bullets.push({
      x: p.x + Math.cos(p.angle) * 18, y: p.y + Math.sin(p.angle) * 18,
      vx: Math.cos(a) * def.bulletSpeed, vy: Math.sin(a) * def.bulletSpeed,
      life: def.range / def.bulletSpeed, damage: def.damage, from: 'player',
    });
  }
  state.effects.shake = Math.max(state.effects.shake, p.weapon === 'shotgun' ? 4 : 1.5);
  state.effects.muzzle = 0.05;
  scarePeds(state, p.x, p.y, 420);
  if (state.police.wanted > 0) state.police.heat += WANTED.shootNearCop * 0.1;
  else if (nearestCopDistance(state) < 500) state.police.heat += WANTED.shootNearCop;
  return true;
}

function nearestCopDistance(state) {
  let best = Infinity;
  for (const cop of state.police.foot) best = Math.min(best, dist(state.player.x, state.player.y, cop.x, cop.y));
  for (const car of state.cars) {
    if (car.driver === 'police') best = Math.min(best, dist(state.player.x, state.player.y, car.x, car.y));
  }
  return best;
}

/** Damage the player (armour absorbs first); returns true if he went down. */
export function damagePlayer(state, amount) {
  const p = state.player;
  if (!p.alive) return true;
  const taken = state.crew.muscle ? amount * 0.75 : amount;
  const absorbed = Math.min(p.armor, taken * 0.7);
  p.armor -= absorbed;
  p.health -= taken - absorbed;
  state.effects.flash = 0.15;
  if (p.health <= 0) {
    p.health = 0;
    p.alive = false;
    return true;
  }
  return false;
}

export function healPlayer(state, amount) {
  state.player.health = clamp(state.player.health + amount, 0, PLAYER.maxHealth);
}

export function addCash(state, amount) {
  state.player.cash += amount;
  state.stats.earned += amount;
}

export function addRespect(state, amount) {
  state.player.respect += amount;
}

/** Move the player on foot with WASD, pushing out of buildings. */
export function movePlayerOnFoot(state, input, dt) {
  const p = state.player;
  if (!p.alive) return;
  let mx = 0;
  let my = 0;
  if (input.up) my -= 1;
  if (input.down) my += 1;
  if (input.left) mx -= 1;
  if (input.right) mx += 1;
  const moving = mx !== 0 || my !== 0;
  if (moving) {
    const len = Math.hypot(mx, my);
    const speed = input.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
    const nx = p.x + (mx / len) * speed * dt;
    const ny = p.y + (my / len) * speed * dt;
    const out = pushOutOfBuildings(state.city, nx, ny, PLAYER.radius);
    const c = clampToWorld(out.x, out.y);
    p.x = c.x;
    p.y = c.y;
    p.angle = Math.atan2(p.aimY - p.y, p.aimX - p.x);
  }
  if (input.aimX !== undefined) {
    p.aimX = input.aimX;
    p.aimY = input.aimY;
    if (!moving) p.angle = Math.atan2(p.aimY - p.y, p.aimX - p.x);
  }
}

/** Advance all bullets; walls stop them, bodies take damage. */
export function updateBullets(state, dt) {
  const keep = [];
  for (const b of state.bullets) {
    b.life -= dt;
    if (b.life <= 0) continue;
    const nx = b.x + b.vx * dt;
    const ny = b.y + b.vy * dt;
    if (segmentBlocked(state.city, b.x, b.y, nx, ny)) {
      spawnSmoke(state, nx, ny, 1);
      continue;
    }
    b.x = nx;
    b.y = ny;
    if (b.from === 'player') {
      if (hitTargets(state, b)) continue;
    } else if (dist(b.x, b.y, state.player.x, state.player.y) < 16 && state.player.onFoot) {
      damagePlayer(state, b.damage);
      continue;
    }
    keep.push(b);
  }
  state.bullets = keep;
}

/** A player bullet meets rivals, cops, peds or cars. Returns true on a hit. */
function hitTargets(state, b) {
  for (const r of state.rivals) {
    if (r.alive && dist(b.x, b.y, r.x, r.y) < 16) {
      r.health -= b.damage;
      if (r.health <= 0) {
        r.alive = false;
        state.stats.kills += 1;
        state.police.heat += WANTED.killRival;
        addRespect(state, 6);
      }
      return true;
    }
  }
  for (const cop of state.police.foot) {
    if (cop.alive && dist(b.x, b.y, cop.x, cop.y) < 16) {
      cop.health -= b.damage;
      if (cop.health <= 0) {
        cop.alive = false;
        state.stats.kills += 1;
        state.police.heat += WANTED.killCop;
      }
      return true;
    }
  }
  for (const ped of state.peds) {
    if (dist(b.x, b.y, ped.x, ped.y) < 14) {
      state.peds.splice(state.peds.indexOf(ped), 1);
      state.stats.kills += 1;
      state.police.heat += WANTED.killPed;
      scarePeds(state, b.x, b.y, 500);
      return true;
    }
  }
  for (const car of state.cars) {
    if (Math.abs(b.x - car.x) < car.length / 2 + 4 && Math.abs(b.y - car.y) < car.width / 2 + 4) {
      car.health -= b.damage;
      return true;
    }
  }
  return false;
}

/** Per-frame player upkeep: cooldowns, reloads, death by wanted bust. */
export function updatePlayer(state, dt) {
  const p = state.player;
  if (p.cooldown > 0) p.cooldown -= dt;
  if (p.reload > 0) {
    p.reload -= dt;
    if (p.reload <= 0) {
      const def = WEAPONS[p.weapon];
      const slot = p.weapons[p.weapon];
      const take = Math.min(def.mag, slot.ammo);
      slot.mag = take;
      slot.ammo -= take;
    }
  }
}

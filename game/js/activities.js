// The side life of Solmar Bay: taxi fares, twelve hidden packages, Rosa's
// garage (engine and armour upgrades, resprays that clear wanted), the gun
// store, three hireable crew members and five respect ranks.

import { CREW, GARAGE, RESPECT_RANKS, RESPECT_THRESHOLDS, WEAPONS } from './config.js';
import { dist } from './random.js';
import { addCash, addRespect, giveAmmo, healPlayer } from './player.js';
import { clearWanted } from './police.js';

export function respectRank(respect) {
  let rank = 0;
  for (let i = 0; i < RESPECT_THRESHOLDS.length; i += 1) {
    if (respect >= RESPECT_THRESHOLDS[i]) rank = i;
  }
  return { index: rank, name: RESPECT_RANKS[rank] };
}

/** Start a taxi fare: a passenger nearby wants a ride across town. */
export function startTaxiFare(state) {
  const p = state.player;
  const stands = state.city.taxiStands;
  const near = stands.find((s) => dist(p.x, p.y, s.x, s.y) < 120);
  if (!near) return null;
  const dest = {
    x: state.rng.range(500, 3400),
    y: state.rng.range(300, 2500),
  };
  const fare = 80 + Math.round(dist(p.x, p.y, dest.x, dest.y) / 12);
  state.taxi = {
    active: true, dest, fare,
    timer: 90 + dist(p.x, p.y, dest.x, dest.y) / 30,
    passenger: 'Fare',
  };
  return state.taxi;
}

/** Update the active fare: pay out on arrival, fail on timeout. */
export function updateTaxi(state, dt) {
  const t = state.taxi;
  if (!t || !t.active) return null;
  t.timer -= dt;
  if (t.timer <= 0) {
    state.taxi = null;
    return 'failed';
  }
  if (dist(state.player.x, state.player.y, t.dest.x, t.dest.y) < 70) {
    addCash(state, t.fare);
    addRespect(state, 12);
    state.stats.fares += 1;
    state.taxi = null;
    return 'paid';
  }
  return null;
}

/** Pick up any hidden package the player is standing on. */
export function collectPackages(state) {
  let found = 0;
  for (const pkg of state.city.packages) {
    if (!pkg.taken && dist(state.player.x, state.player.y, pkg.x, pkg.y) < 40) {
      pkg.taken = true;
      found += 1;
      addCash(state, 100);
      addRespect(state, 25);
      state.stats.packages += 1;
    }
  }
  return found;
}

/** Is the player at Rosa's garage? */
export function atGarage(state) {
  const g = state.city.garage;
  return state.player.x > g.x - 60 && state.player.x < g.x + g.w + 60
    && state.player.y > g.y - 60 && state.player.y < g.y + g.h + 60;
}

/** Is the player at the gun store? */
export function atGunStore(state) {
  const g = state.city.gunStore;
  return state.player.x > g.x - 50 && state.player.x < g.x + g.w + 50
    && state.player.y > g.y - 50 && state.player.y < g.y + g.h + 50;
}

/** Buy the next engine level. Returns true on success. */
export function buyEngine(state) {
  const level = state.upgrades.engine || 0;
  if (level >= GARAGE.engine.length - 1) return false;
  const price = GARAGE.engine[level + 1];
  if (state.player.cash < price) return false;
  state.player.cash -= price;
  state.upgrades.engine = level + 1;
  return true;
}

/** Buy the next armour level (adds armour plates to the player). */
export function buyArmor(state) {
  const level = state.upgrades.armor || 0;
  if (level >= GARAGE.armor.length - 1) return false;
  const price = GARAGE.armor[level + 1];
  if (state.player.cash < price) return false;
  state.player.cash -= price;
  state.upgrades.armor = level + 1;
  state.player.armor = 100;
  return true;
}

/** A respray clears the wanted level and repairs the current car. */
export function respray(state) {
  if (state.player.cash < GARAGE.respray) return false;
  state.player.cash -= GARAGE.respray;
  clearWanted(state);
  const car = state.cars.find((c) => c.id === state.player.inCar);
  if (car) {
    car.health = 100;
    car.wrecked = false;
    car.color = '#e91e63';
  }
  return true;
}

/** Buy ammo for a weapon at the gun store. */
export function buyAmmo(state, weapon, rounds, price) {
  if (state.player.cash < price) return false;
  state.player.cash -= price;
  giveAmmo(state, weapon, rounds);
  return true;
}

/** Buy a health pack at the gun store. */
export function buyMedkit(state) {
  if (state.player.cash < 120) return false;
  state.player.cash -= 120;
  healPlayer(state, 100);
  return true;
}

/** Hire a crew member by id. Returns the member or null. */
export function hireCrew(state, id) {
  const member = CREW.find((c) => c.id === id);
  if (!member || state.crew[id]) return null;
  if (state.player.cash < member.price) return null;
  state.player.cash -= member.price;
  state.crew[id] = true;
  return member;
}

/** Weapon prices at the gun store. */
export function gunStoreStock(state) {
  return [
    { weapon: 'pistol', label: 'Pistol ammo ×24', rounds: 24, price: 60 },
    { weapon: 'smg', label: 'SMG ammo ×60', rounds: 60, price: 150, locked: WEAPONS.smg.unlock > state.stats.missionsDone },
    { weapon: 'shotgun', label: 'Shells ×12', rounds: 12, price: 140, locked: WEAPONS.shotgun.unlock > state.stats.missionsDone },
  ];
}

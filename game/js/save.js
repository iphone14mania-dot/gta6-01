// Saving: the player's progress (cash, respect, missions done, packages,
// upgrades, crew, position) serialises to plain JSON and lives in
// localStorage. The pure serialize/deserialize pair is what the Node test
// exercises; the storage calls are guarded so a private window never throws.

import { SAVE_KEY } from './config.js';

export function serializeSave(state) {
  return {
    version: 1,
    cash: state.player.cash,
    respect: state.player.respect,
    health: state.player.health,
    armor: state.player.armor,
    x: state.player.x,
    y: state.player.y,
    missionsDone: state.stats.missionsDone,
    packages: state.city.packages.map((p) => p.taken),
    upgrades: { ...state.upgrades },
    crew: { ...state.crew },
    weapons: JSON.parse(JSON.stringify(state.player.weapons)),
    earned: state.stats.earned,
    kills: state.stats.kills,
    fares: state.stats.fares,
    carsStolen: state.stats.carsStolen,
  };
}

export function applySave(state, data) {
  if (!data || data.version !== 1) return false;
  state.player.cash = data.cash;
  state.player.respect = data.respect;
  state.player.health = data.health;
  state.player.armor = data.armor;
  state.player.x = data.x;
  state.player.y = data.y;
  state.stats.missionsDone = data.missionsDone;
  state.stats.earned = data.earned || 0;
  state.stats.kills = data.kills || 0;
  state.stats.fares = data.fares || 0;
  state.stats.carsStolen = data.carsStolen || 0;
  state.city.packages.forEach((p, i) => { p.taken = !!data.packages[i]; });
  state.upgrades = { ...data.upgrades };
  state.crew = { ...data.crew };
  state.player.weapons = JSON.parse(JSON.stringify(data.weapons));
  return true;
}

export function saveGame(state) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(serializeSave(state)));
    return true;
  } catch {
    return false;
  }
}

export function loadGame(state) {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    return applySave(state, JSON.parse(raw));
  } catch {
    return false;
  }
}

export function hasSave() {
  try {
    return window.localStorage.getItem(SAVE_KEY) !== null;
  } catch {
    return false;
  }
}

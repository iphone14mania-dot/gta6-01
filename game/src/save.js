// Save and load: money, respect, missions, weapons and the garage, kept in
// the browser's localStorage so progress survives a visit.

import { SAVE_KEY } from './config.js';

export function saveGame(player, missions, garageCars) {
  try {
    const data = {
      v: 1,
      money: player.money,
      respect: player.respect,
      missionsDone: missions.completedCount,
      weapons: Object.keys(player.weapons),
      stats: player.stats,
      garage: garageCars.map((c) => ({ type: c.type, x: c.x, z: c.z, heading: c.heading })),
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.v !== 1) return null;
    return data;
  } catch {
    return null;
  }
}

export function applySave(data, player, missions) {
  if (!data) return;
  player.money = data.money ?? player.money;
  player.respect = data.respect ?? 0;
  player.addRespect(0);
  for (const w of data.weapons || []) player.giveWeapon(w);
  if (data.stats) Object.assign(player.stats, data.stats);
  missions.setCompleted(data.missionsDone || 0);
}

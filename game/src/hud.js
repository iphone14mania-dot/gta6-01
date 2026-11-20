// The HUD: wanted stars, health, money, speed, weapon, mission objective, and
// the minimap — a live 2D canvas of the streets with blips for the player,
// the mission, the cops and the cars.

import { CITY, WEAPONS } from './config.js';

export function createHud(world) {
  const el = (id) => document.getElementById(id);
  const els = {
    stars: el('hud-stars'),
    money: el('hud-money'),
    healthFill: el('hud-health-fill'),
    healthText: el('hud-health-text'),
    respect: el('hud-respect'),
    speed: el('hud-speed'),
    vehicle: el('hud-vehicle'),
    weapon: el('hud-weapon'),
    ammo: el('hud-ammo'),
    objective: el('hud-objective'),
    timer: el('hud-timer'),
    radio: el('hud-radio'),
    toast: el('hud-toast'),
    toastTitle: el('hud-toast-title'),
    toastBody: el('hud-toast-body'),
    damage: el('hud-damage'),
    crosshair: el('hud-crosshair'),
    minimap: el('hud-minimap'),
  };
  const mapCtx = els.minimap.getContext('2d');
  const MAP = 176;
  let toastTimer = null;
  let lastHealth = 100;

  function toMap(x, z) {
    const s = MAP / (CITY.bounds * 2 + 200);
    return [(x + CITY.bounds + 100) * s, (z + CITY.bounds + 100) * s];
  }

  function drawMinimap(player, mission, cops, cars) {
    const g = mapCtx;
    g.clearRect(0, 0, MAP, MAP);
    g.fillStyle = 'rgba(12, 18, 28, 0.82)';
    g.fillRect(0, 0, MAP, MAP);
    // streets
    g.strokeStyle = 'rgba(200, 205, 215, 0.55)';
    g.lineWidth = 2;
    for (const s of world.streets) {
      const [ax, ay] = toMap(s, -CITY.bounds);
      const [bx, by] = toMap(s, CITY.bounds);
      g.beginPath();
      g.moveTo(ax, ay);
      g.lineTo(bx, by);
      g.stroke();
      const [cx, cy] = toMap(-CITY.bounds, s);
      const [dx, dy] = toMap(CITY.bounds, s);
      g.beginPath();
      g.moveTo(cx, cy);
      g.lineTo(dx, dy);
      g.stroke();
    }
    // ocean
    g.fillStyle = 'rgba(30, 111, 142, 0.8)';
    const [ox] = toMap(CITY.beachX, 0);
    g.fillRect(ox, 0, MAP - ox, MAP);
    // mission marker
    const mpos = mission.markerPos() || mission.startMarkerPos();
    if (mpos) {
      const [mx, my] = toMap(mpos.x, mpos.z);
      g.fillStyle = '#ffd94c';
      g.beginPath();
      g.arc(mx, my, 5, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#fff';
      g.lineWidth = 1.5;
      g.stroke();
    }
    // cop blips (flashing)
    const flash = Math.floor(performance.now() / 300) % 2 === 0;
    g.fillStyle = flash ? '#ff4444' : '#4477ff';
    for (const c of cops) {
      const [cx, cy] = toMap(c.x, c.z);
      g.beginPath();
      g.arc(cx, cy, 3.5, 0, Math.PI * 2);
      g.fill();
    }
    // player arrow
    const [px, py] = toMap(player.x, player.z);
    g.save();
    g.translate(px, py);
    g.rotate(Math.atan2(Math.sin(player.heading), Math.cos(player.heading)) + Math.PI / 2);
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.moveTo(0, -7);
    g.lineTo(5, 6);
    g.lineTo(-5, 6);
    g.closePath();
    g.fill();
    g.strokeStyle = '#222';
    g.lineWidth = 1;
    g.stroke();
    g.restore();
  }

  return {
    toast(title, body, ms = 4200) {
      els.toastTitle.textContent = title;
      els.toastBody.textContent = body;
      els.toast.classList.add('show');
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => els.toast.classList.remove('show'), ms);
    },
    dismissToast() {
      if (toastTimer) clearTimeout(toastTimer);
      els.toast.classList.remove('show');
    },
    update(state) {
      const { player, police, mission, audio } = state;
      const stars = '★'.repeat(police.stars) + '☆'.repeat(5 - police.stars);
      els.stars.textContent = stars;
      els.stars.style.color = police.stars > 0 ? '#ffd94c' : 'rgba(255,255,255,0.5)';
      els.money.textContent = `$${player.money.toLocaleString('en-US')}`;
      els.healthFill.style.width = `${player.health}%`;
      els.healthFill.style.background = player.health > 50 ? '#4caf50' : player.health > 25 ? '#ff9800' : '#f44336';
      els.healthText.textContent = `${Math.ceil(player.health)}`;
      els.respect.textContent = `${player.rankName()} · ${player.respect} respect`;
      const kmh = Math.round((player.car ? Math.abs(player.car.speed) : 0) * 3.6);
      els.speed.textContent = player.car ? `${kmh}` : '—';
      els.vehicle.textContent = player.car ? player.car.spec.name : 'On foot';
      const w = WEAPONS[player.weapon];
      const inv = player.weapons[player.weapon];
      els.weapon.textContent = w.name;
      els.ammo.textContent = inv ? `${inv.ammo} / ${inv.reserve}` : '—';
      els.objective.textContent = mission.currentLabel();
      const t = mission.timerLeft();
      els.timer.textContent = t > 0 ? `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}` : '';
      els.timer.style.color = t > 0 && t < 20 ? '#ff5252' : '#ffd94c';
      els.radio.textContent = audio.isMuted ? 'MUTED (M)' : audio.stationName;
      els.crosshair.style.display = player.car || player.dead ? 'none' : 'block';
      if (player.health < lastHealth) {
        els.damage.classList.add('flash');
        setTimeout(() => els.damage.classList.remove('flash'), 300);
      }
      lastHealth = player.health;
      drawMinimap(player, mission, police.copCars, state.trafficCars);
    },
  };
}

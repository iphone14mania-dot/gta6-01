// The renderer: one canvas, painted in layers — sea and sand, grass and
// roads, buildings with long golden-hour shadows, palms, cars, people, the
// player, bullets and particles — then the HUD (minimap, wanted stars,
// health, cash, speedometer, objective) and the menu screens on top.

import { AVENUES, STREETS, ROAD_WIDTH, WORLD, PALETTE, FONT, SUN, RESPECT_RANKS } from './config.js';
import { DISTRICTS, districtAt } from './city.js';
import { missionTarget } from './missions.js';
import { respectRank } from './activities.js';
import { clamp } from './random.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BRIEFING = 'briefing';
export const SCREEN_MISSION_END = 'missionEnd';
export const SCREEN_WASTED = 'wasted';
export const SCREEN_BUSTED = 'busted';

/** Logical view width the camera shows; the canvas scales to fit. */
const VIEW_WIDTH = 1150;

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let view = { w: 1280, h: 800, scale: 1 };
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    view = { w, h, scale: (w / VIEW_WIDTH) * dpr };
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  /** Convert a screen pixel to world coordinates (for aiming). */
  function screenToWorld(state, sx, sy) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cam = cameraOf(state);
    return {
      x: cam.x + (sx * dpr - canvas.width / 2) / view.scale,
      y: cam.y + (sy * dpr - canvas.height / 2) / view.scale,
    };
  }

  function cameraOf(state) {
    const halfW = canvas.width / 2 / view.scale;
    const halfH = canvas.height / 2 / view.scale;
    return {
      x: clamp(state.camera.x, halfW - 40, WORLD.width - halfW + 40),
      y: clamp(state.camera.y, halfH - 40, WORLD.height - halfH + 40),
    };
  }

  function drawWorld(state) {
    const cam = cameraOf(state);
    const shake = state.effects.shake;
    const shx = shake > 0 ? (Math.random() - 0.5) * shake : 0;
    const shy = shake > 0 ? (Math.random() - 0.5) * shake : 0;
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(view.scale, view.scale);
    ctx.translate(-cam.x + shx, -cam.y + shy);

    const vw = canvas.width / view.scale;
    const vh = canvas.height / view.scale;
    const left = cam.x - vw / 2 - 60;
    const top = cam.y - vh / 2 - 60;
    const right = cam.x + vw / 2 + 60;
    const bottom = cam.y + vh / 2 + 60;

    // Ground: grass, then the sea and sand on the west edge.
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(left, top, right - left, bottom - top);
    ctx.fillStyle = PALETTE.sea;
    ctx.fillRect(left, top, WORLD.seaWidth - left, bottom - top);
    ctx.fillStyle = PALETTE.seaDeep;
    for (let y = Math.floor(top / 90) * 90; y < bottom; y += 90) {
      const wobble = Math.sin(y * 0.01 + state.time * 0.9) * 14;
      ctx.fillRect(WORLD.seaWidth - 46 + wobble, y, 46 - wobble, 34);
    }
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(WORLD.seaWidth, top, WORLD.sandWidth, bottom - top);

    // District tints.
    for (const d of DISTRICTS) {
      ctx.fillStyle = d.tint;
      ctx.globalAlpha = 0.35;
      ctx.fillRect(d.x, d.y, d.w, d.h);
      ctx.globalAlpha = 1;
    }

    // Roads: asphalt, sidewalks, centre dashes.
    ctx.fillStyle = PALETTE.sidewalk;
    for (const a of AVENUES) ctx.fillRect(a - ROAD_WIDTH / 2 - 12, top, ROAD_WIDTH + 24, bottom - top);
    for (const s of STREETS) ctx.fillRect(left, s - ROAD_WIDTH / 2 - 12, right - left, ROAD_WIDTH + 24);
    ctx.fillStyle = PALETTE.road;
    for (const a of AVENUES) ctx.fillRect(a - ROAD_WIDTH / 2, top, ROAD_WIDTH, bottom - top);
    for (const s of STREETS) ctx.fillRect(left, s - ROAD_WIDTH / 2, right - left, ROAD_WIDTH);
    ctx.fillStyle = PALETTE.roadLine;
    for (const a of AVENUES) {
      for (let y = Math.floor(top / 64) * 64; y < bottom; y += 64) ctx.fillRect(a - 2, y, 4, 30);
    }
    for (const s of STREETS) {
      for (let x = Math.floor(left / 64) * 64; x < right; x += 64) ctx.fillRect(x, s - 2, 30, 4);
    }

    // Buildings: long shadow first, then the block and its roof details.
    for (const b of state.city.buildings) {
      if (b.x > right || b.x + b.w < left || b.y > bottom || b.y + b.h < top) continue;
      const sh = SUN.length * b.height;
      ctx.fillStyle = PALETTE.shadow;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y + b.h);
      ctx.lineTo(b.x + b.w, b.y + b.h);
      ctx.lineTo(b.x + b.w + SUN.x * sh, b.y + b.h + SUN.y * sh);
      ctx.lineTo(b.x + SUN.x * sh, b.y + b.h + SUN.y * sh);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = PALETTE.buildingWall;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x + 4, b.y + 4, b.w - 8, b.h - 8);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      const cols = Math.max(1, Math.floor(b.w / 34));
      const rows = Math.max(1, Math.floor(b.h / 30));
      for (let i = 0; i < cols; i += 1) {
        for (let j = 0; j < rows; j += 1) {
          ctx.fillRect(b.x + 10 + i * 34, b.y + 10 + j * 30, 14, 10);
        }
      }
    }

    // Landmarks: garage and gun store.
    drawLandmark(state.city.garage, '#ff7043', "ROSA'S GARAGE");
    drawLandmark(state.city.gunStore, '#78909c', 'HARBOR ARMS');

    // Trees and palms.
    for (const t of state.city.trees) {
      ctx.fillStyle = '#558b2f';
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const pl of state.city.palms) drawPalm(pl.x, pl.y, pl.s);

    // Skid marks.
    ctx.strokeStyle = 'rgba(20,20,20,0.5)';
    ctx.lineWidth = 5;
    for (const s of state.skids) {
      ctx.beginPath();
      ctx.moveTo(s.x - Math.cos(s.angle) * 14, s.y - Math.sin(s.angle) * 14);
      ctx.lineTo(s.x + Math.cos(s.angle) * 14, s.y + Math.sin(s.angle) * 14);
      ctx.stroke();
    }

    // Hidden packages glow.
    for (const pkg of state.city.packages) {
      if (pkg.taken) continue;
      const pulse = 0.6 + Math.sin(state.time * 4 + pkg.x) * 0.4;
      ctx.fillStyle = `rgba(0, 230, 118, ${0.35 + pulse * 0.4})`;
      ctx.beginPath();
      ctx.arc(pkg.x, pkg.y, 16 + pulse * 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#00c853';
      ctx.fillRect(pkg.x - 6, pkg.y - 6, 12, 12);
    }

    // Roadblocks.
    for (const rb of state.police.roadblocks) {
      ctx.save();
      ctx.translate(rb.x, rb.y);
      ctx.rotate(rb.angle);
      ctx.fillStyle = '#ff6d00';
      ctx.fillRect(-46, -10, 92, 20);
      ctx.fillStyle = '#fff';
      for (let i = -40; i < 40; i += 16) ctx.fillRect(i, -10, 8, 20);
      ctx.restore();
    }

    // Cars, pedestrians, rivals, the player.
    for (const car of state.cars) drawCar(car);
    for (const ped of state.peds) drawPed(ped);
    for (const r of state.rivals) if (r.alive) drawPerson(r.x, r.y, r.angle, '#ab47bc', true);
    const p = state.player;
    if (p.alive && p.onFoot) drawPerson(p.x, p.y, p.angle, PALETTE.player, true);

    // Bullets and particles.
    ctx.fillStyle = '#fff59d';
    for (const b of state.bullets) {
      ctx.fillRect(b.x - 3, b.y - 1.5, 7, 3);
    }
    for (const pt of state.particles) {
      const a = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.type === 'fire' ? `rgba(255, ${Math.floor(120 + 100 * a)}, 0, ${a})` : `rgba(80, 80, 80, ${a * 0.6})`;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size * (pt.type === 'fire' ? a : 1.6 - a), 0, Math.PI * 2);
      ctx.fill();
    }

    // The helicopter, with its rotor blur and searchlight.
    const heli = state.police.heli;
    if (heli) {
      ctx.save();
      ctx.translate(heli.x, heli.y);
      ctx.fillStyle = 'rgba(255, 255, 200, 0.10)';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-70, 260);
      ctx.lineTo(70, 260);
      ctx.closePath();
      ctx.fill();
      ctx.rotate(heli.angle);
      ctx.fillStyle = PALETTE.heli;
      ctx.fillRect(-22, -10, 44, 20);
      ctx.fillStyle = '#90a4ae';
      ctx.fillRect(14, -4, 22, 8);
      ctx.strokeStyle = 'rgba(40,40,40,0.7)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-34, 0);
      ctx.lineTo(34, 0);
      ctx.stroke();
      ctx.restore();
      // Ground shadow.
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(heli.x + 30, heli.y + 46, 26, 10, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // Damage flash.
    if (state.effects.flash > 0) {
      ctx.fillStyle = `rgba(255, 0, 0, ${state.effects.flash * 0.5})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }

  function drawLandmark(spot, color, label) {
    ctx.fillStyle = PALETTE.shadow;
    ctx.fillRect(spot.x + 14, spot.y + 14, spot.w, spot.h);
    ctx.fillStyle = color;
    ctx.fillRect(spot.x, spot.y, spot.w, spot.h);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = `bold ${13}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(label, spot.x + spot.w / 2, spot.y + spot.h / 2 + 4);
  }

  function drawPalm(x, y, s) {
    ctx.strokeStyle = PALETTE.palmTrunk;
    ctx.lineWidth = 4 * s;
    ctx.beginPath();
    ctx.moveTo(x, y + 12 * s);
    ctx.lineTo(x, y - 6 * s);
    ctx.stroke();
    ctx.strokeStyle = PALETTE.palm;
    ctx.lineWidth = 5 * s;
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(x, y - 6 * s);
      ctx.quadraticCurveTo(x + Math.cos(a) * 12 * s, y - 12 * s, x + Math.cos(a) * 18 * s, y - 2 * s);
      ctx.stroke();
    }
  }

  function drawCar(car) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    ctx.fillStyle = PALETTE.shadow;
    ctx.fillRect(-car.length / 2 + 6, -car.width / 2 + 8, car.length, car.width);
    ctx.fillStyle = car.wrecked ? '#424242' : car.color;
    roundRect(-car.length / 2, -car.width / 2, car.length, car.width, 7);
    ctx.fill();
    ctx.fillStyle = 'rgba(180, 220, 255, 0.85)';
    ctx.fillRect(-car.length / 2 + 10, -car.width / 2 + 4, 10, car.width - 8);
    ctx.fillRect(car.length / 2 - 18, -car.width / 2 + 4, 8, car.width - 8);
    if (car.driver === 'police') {
      ctx.fillStyle = '#fff';
      ctx.fillRect(-6, -car.width / 2 + 2, 12, car.width - 4);
      const blink = Math.floor(performance.now() / 260) % 2 === 0;
      ctx.fillStyle = blink ? '#ff1744' : '#2979ff';
      ctx.beginPath();
      ctx.arc(-2, -car.width / 2 + 4, 4, 0, Math.PI * 2);
      ctx.arc(-2, car.width / 2 - 4, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    if (car.brakeLight) {
      ctx.fillStyle = '#ff1744';
      ctx.fillRect(-car.length / 2 - 2, -car.width / 2 + 3, 4, 5);
      ctx.fillRect(-car.length / 2 - 2, car.width / 2 - 8, 4, 5);
    }
    ctx.restore();
  }

  function drawPed(ped) {
    drawPerson(ped.x, ped.y, ped.angle, ped.shirt, false);
  }

  function drawPerson(x, y, angle, color, armed) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = PALETTE.shadow;
    ctx.beginPath();
    ctx.ellipse(4, 6, 11, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffccbc';
    ctx.beginPath();
    ctx.arc(2, 0, 5.5, 0, Math.PI * 2);
    ctx.fill();
    if (armed) {
      ctx.fillStyle = '#263238';
      ctx.fillRect(8, -2, 14, 4);
    }
    ctx.restore();
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawHUD(state, ui) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = canvas.width / dpr;
    const H = canvas.height / dpr;
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    // Minimap.
    const mw = 200;
    const mh = 150;
    const mx = 16;
    const my = 16;
    ctx.fillStyle = PALETTE.panel;
    roundRect(mx - 6, my - 6, mw + 12, mh + 12, 8);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.rect(mx, my, mw, mh);
    ctx.clip();
    ctx.fillStyle = '#5d8a4a';
    ctx.fillRect(mx, my, mw, mh);
    ctx.fillStyle = PALETTE.sea;
    ctx.fillRect(mx, my, (WORLD.seaWidth / WORLD.width) * mw, mh);
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(mx + (WORLD.seaWidth / WORLD.width) * mw, my, (WORLD.sandWidth / WORLD.width) * mw, mh);
    ctx.strokeStyle = '#d8d2c2';
    ctx.lineWidth = 2;
    for (const a of AVENUES) {
      ctx.beginPath();
      ctx.moveTo(mx + (a / WORLD.width) * mw, my);
      ctx.lineTo(mx + (a / WORLD.width) * mw, my + mh);
      ctx.stroke();
    }
    for (const s of STREETS) {
      ctx.beginPath();
      ctx.moveTo(mx, my + (s / WORLD.height) * mh);
      ctx.lineTo(mx + mw, my + (s / WORLD.height) * mh);
      ctx.stroke();
    }
    const bx = (x) => mx + (x / WORLD.width) * mw;
    const by = (y) => my + (y / WORLD.height) * mh;
    // Mission target blip (pulsing yellow).
    const target = missionTarget(state);
    if (target) {
      const pulse = 5 + Math.sin(state.time * 5) * 2;
      ctx.fillStyle = '#ffea00';
      ctx.beginPath();
      ctx.arc(bx(target.x), by(target.y), pulse, 0, Math.PI * 2);
      ctx.fill();
    }
    if (state.taxi && state.taxi.active) {
      ctx.fillStyle = '#00e5ff';
      ctx.beginPath();
      ctx.arc(bx(state.taxi.dest.x), by(state.taxi.dest.y), 4, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const pkg of state.city.packages) {
      if (pkg.taken) continue;
      ctx.fillStyle = '#00e676';
      ctx.fillRect(bx(pkg.x) - 2, by(pkg.y) - 2, 4, 4);
    }
    for (const car of state.cars) {
      if (car.driver === 'police') {
        ctx.fillStyle = '#2979ff';
        ctx.beginPath();
        ctx.arc(bx(car.x), by(car.y), 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (state.police.heli) {
      ctx.fillStyle = '#ff5252';
      ctx.beginPath();
      ctx.arc(bx(state.police.heli.x), by(state.police.heli.y), 4, 0, Math.PI * 2);
      ctx.fill();
    }
    // Player arrow.
    const p = state.player;
    ctx.save();
    ctx.translate(bx(p.x), by(p.y));
    ctx.rotate(p.angle);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(7, 0);
    ctx.lineTo(-5, -5);
    ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.restore();
    // District name under the minimap, on a dark chip so it reads on grass.
    const districtName = districtAt(p.x, p.y).name.toUpperCase();
    ctx.font = `bold 13px ${FONT}`;
    const dw = ctx.measureText(districtName).width + 16;
    ctx.fillStyle = PALETTE.panel;
    roundRect(mx - 2, my + mh + 8, dw, 20, 5);
    ctx.fill();
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(districtName, mx + 6, my + mh + 23);

    // Wanted stars, top right.
    ctx.textAlign = 'right';
    ctx.font = '28px sans-serif';
    let stars = '';
    for (let i = 0; i < 5; i += 1) stars += i < state.police.wanted ? '★' : '☆';
    ctx.fillStyle = state.police.wanted > 0 ? '#ffd54f' : 'rgba(255,255,255,0.4)';
    ctx.fillText(stars, W - 18, 44);

    // Cash and respect.
    ctx.font = `bold 20px ${FONT}`;
    ctx.fillStyle = '#a5d6a7';
    ctx.fillText(`$${p.cash.toLocaleString()}`, W - 18, 74);
    const rank = respectRank(p.respect);
    ctx.font = `13px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText(`${rank.name}  •  ${p.respect} respect`, W - 18, 94);

    // Health and armour bars, top centre-right.
    const barX = W - 218;
    bar(barX, 112, 200, 10, p.health / 100, '#ef5350', 'HP');
    bar(barX, 128, 200, 10, p.armor / 100, '#42a5f5', 'ARMOUR');

    // Mission objective + timer, top centre.
    if (state.mission) {
      ctx.textAlign = 'center';
      ctx.fillStyle = PALETTE.panel;
      const label = state.mission.def.name.toUpperCase();
      ctx.font = `bold 15px ${FONT}`;
      const tw = Math.max(ctx.measureText(state.mission.objective).width, ctx.measureText(label).width) + 36;
      const panelH = state.mission.timer > 0 ? 80 : 58;
      roundRect(W / 2 - tw / 2, 12, tw, panelH, 8);
      ctx.fill();
      ctx.fillStyle = PALETTE.gold;
      ctx.fillText(label, W / 2, 32);
      ctx.fillStyle = PALETTE.text;
      ctx.font = `14px ${FONT}`;
      ctx.fillText(state.mission.objective, W / 2, 52);
      if (state.mission.timer > 0) {
        ctx.fillStyle = state.mission.timer < 15 ? '#ff5252' : '#fff';
        ctx.font = `bold 16px ${FONT}`;
        ctx.fillText(`${Math.ceil(state.mission.timer)}s`, W / 2, 74);
      }
    }

    // Taxi fare status.
    if (state.taxi && state.taxi.active) {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#00e5ff';
      ctx.font = `bold 14px ${FONT}`;
      ctx.fillText(`TAXI FARE $${state.taxi.fare} — ${Math.ceil(state.taxi.timer)}s`, W / 2, state.mission ? 92 : 32);
    }

    // Speedometer + weapon, bottom right.
    const car = state.cars.find((c) => c.id === p.inCar);
    ctx.textAlign = 'right';
    if (car) {
      const mph = Math.round(Math.abs(car.speed) * 0.14);
      ctx.font = `bold 34px ${FONT}`;
      ctx.fillStyle = PALETTE.text;
      ctx.fillText(`${mph}`, W - 18, H - 56);
      ctx.font = `12px ${FONT}`;
      ctx.fillStyle = PALETTE.muted;
      ctx.fillText('MPH', W - 18, H - 40);
      ctx.fillStyle = car.health > 40 ? '#81c784' : '#ef5350';
      ctx.fillRect(W - 118, H - 30, 100 * (car.health / 100), 6);
    } else {
      const w = state.player.weapons[p.weapon];
      ctx.font = `bold 18px ${FONT}`;
      ctx.fillStyle = PALETTE.text;
      ctx.fillText(`${p.weapon.toUpperCase()}  ${w.mag} / ${w.ammo}`, W - 18, H - 40);
    }
    // Radio station, bottom left.
    ctx.textAlign = 'left';
    ctx.font = `13px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText(`Radio: ${ui.radio}  (R to change)`, 18, H - 18);
    ctx.fillText(`Packages ${state.stats.packages}/12  •  Missions ${state.stats.missionsDone}/8`, 18, H - 38);

    // Notice line.
    if (state.noticeTimer > 0) {
      ctx.textAlign = 'center';
      ctx.font = `bold 20px ${FONT}`;
      ctx.fillStyle = PALETTE.gold;
      ctx.fillText(state.notice, W / 2, H - 120);
    }

    // Context hint.
    if (ui.hint) {
      ctx.textAlign = 'center';
      ctx.font = `15px ${FONT}`;
      ctx.fillStyle = '#fff';
      ctx.fillText(ui.hint, W / 2, H - 88);
    }
    ctx.restore();
  }

  function bar(x, y, w, h, frac, color, label) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w * clamp(frac, 0, 1), h);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 9px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText(label, x + 3, y + h - 2);
    ctx.textAlign = 'right';
  }

  function panelScreen(title, lines, footer, accent) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = canvas.width / dpr;
    const H = canvas.height / dpr;
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.fillStyle = 'rgba(10, 8, 6, 0.72)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = accent || PALETTE.gold;
    ctx.font = `bold 54px ${FONT}`;
    ctx.fillText(title, W / 2, H / 2 - 90);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `17px ${FONT}`;
    lines.forEach((line, i) => ctx.fillText(line, W / 2, H / 2 - 30 + i * 28));
    if (footer) {
      ctx.fillStyle = PALETTE.muted;
      ctx.font = `15px ${FONT}`;
      ctx.fillText(footer, W / 2, H / 2 + 130);
    }
    ctx.restore();
  }

  function drawTitle(state, ui) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = canvas.width / dpr;
    const H = canvas.height / dpr;
    ctx.save();
    ctx.scale(dpr, dpr);
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, 'rgba(20, 10, 30, 0.55)');
    grad.addColorStop(1, 'rgba(255, 140, 40, 0.35)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff7043';
    ctx.font = `bold 26px ${FONT}`;
    ctx.fillText('S O L M A R   B A Y', W / 2, H / 2 - 120);
    ctx.fillStyle = '#fff';
    ctx.font = `bold 84px ${FONT}`;
    ctx.fillText('SOLMAR BAY', W / 2, H / 2 - 40);
    ctx.fillStyle = PALETTE.gold;
    ctx.font = `20px ${FONT}`;
    ctx.fillText('An open-world crime story — 8 jobs, 5 stars, one bay to own.', W / 2, H / 2 + 2);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `16px ${FONT}`;
    const lines = [
      'WASD drive / walk  •  Mouse aim  •  Click shoot  •  F enter / exit car',
      'Q switch weapon  •  E interact  •  R radio  •  Shift run  •  Space handbrake',
      'P pause  •  M mute  •  Progress saves automatically',
    ];
    lines.forEach((line, i) => ctx.fillText(line, W / 2, H / 2 + 44 + i * 26));
    const blink = Math.floor(state.time * 1.6) % 2 === 0;
    if (blink) {
      ctx.fillStyle = '#fff';
      ctx.font = `bold 22px ${FONT}`;
      ctx.fillText(ui.hasSave ? 'PRESS ENTER TO CONTINUE' : 'PRESS ENTER TO START', W / 2, H / 2 + 150);
    }
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `13px ${FONT}`;
    ctx.fillText('A wholly original game: its city, people and story are invented. No Rockstar material.', W / 2, H - 24);
    ctx.restore();
  }

  function drawBriefing(state, ui) {
    const m = ui.briefing;
    if (!m) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = canvas.width / dpr;
    const H = canvas.height / dpr;
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.fillStyle = 'rgba(10, 8, 6, 0.78)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.gold;
    ctx.font = `bold 40px ${FONT}`;
    ctx.fillText(`JOB ${m.index + 1}: ${m.def.name.toUpperCase()}`, W / 2, H / 2 - 120);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `17px ${FONT}`;
    m.def.brief.forEach((line, i) => ctx.fillText(line, W / 2, H / 2 - 60 + i * 28));
    ctx.fillStyle = '#a5d6a7';
    ctx.font = `bold 18px ${FONT}`;
    ctx.fillText(`Reward: $${m.def.reward}  •  +${m.def.respect} respect`, W / 2, H / 2 + 30);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `15px ${FONT}`;
    ctx.fillText('ENTER to start the job   •   ESC to walk away', W / 2, H / 2 + 90);
    ctx.restore();
  }

  function draw(state, ui) {
    drawWorld(state);
    if (ui.screen === SCREEN_PLAY || ui.screen === SCREEN_PAUSED || ui.screen === SCREEN_BRIEFING) {
      drawHUD(state, ui);
    }
    if (ui.screen === SCREEN_TITLE) drawTitle(state, ui);
    else if (ui.screen === SCREEN_PAUSED) {
      panelScreen('PAUSED', [
        'Take a breath, Leo. The bay waits.',
        `Cash $${state.player.cash.toLocaleString()}  •  Missions ${state.stats.missionsDone}/8  •  Packages ${state.stats.packages}/12`,
      ], 'ENTER or P to resume  •  Progress saves automatically');
    } else if (ui.screen === SCREEN_BRIEFING) drawBriefing(state, ui);
    else if (ui.screen === SCREEN_MISSION_END) {
      panelScreen(ui.endTitle, ui.endLines, 'ENTER to continue', ui.endTitle.includes('PASSED') ? '#81c784' : '#ef5350');
    } else if (ui.screen === SCREEN_WASTED) {
      panelScreen('WASTED', ['Leo went down in Solmar Bay.', 'The hospital patched him up — minus $100.'], 'ENTER to get back out there', '#ef5350');
    } else if (ui.screen === SCREEN_BUSTED) {
      panelScreen('BUSTED', ['The SBPD caught up with Leo.', 'Bail cost $200. The heat is off — for now.'], 'ENTER to get back out there', '#42a5f5');
    }
  }

  return { draw, resize, screenToWorld };
}

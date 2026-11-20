// Boot and game loop. Fixed 60 Hz steps with an accumulator; the loop reads
// input, fires the weapon toward the mouse, handles the menu screens and the
// interactions (mission marker, taxi stands, garage, gun store), and hands
// the world to the renderer. `?shot=<name>` stages a screenshot and freezes
// it; `?selftest=1` runs the headless smoke test and reports in the DOM.

import { STEP, SAVE_KEY } from './config.js';
import { createWorld, stepWorld, EVENT_WASTED, EVENT_BUSTED, EVENT_MISSION_PASSED, EVENT_MISSION_FAILED, notify, snapCamera } from './world.js';
import { createRenderer, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_BRIEFING, SCREEN_MISSION_END, SCREEN_WASTED, SCREEN_BUSTED } from './render.js';
import { createInput, ACTION_CONFIRM, ACTION_PAUSE, ACTION_ENTER_CAR, ACTION_FIRE, ACTION_WEAPON, ACTION_INTERACT, ACTION_RADIO } from './input.js';
import { createAudio, startAudio, updateAudio, playGunshot, playCash, cycleStation, stationName } from './audio.js';
import { fireWeapon, cycleWeapon, damagePlayer } from './player.js';
import { stealCar, exitCar } from './vehicles.js';
import { startMission, completeMission, MISSIONS } from './missions.js';
import { atGarage, atGunStore, startTaxiFare, buyEngine, buyArmor, respray, buyAmmo, buyMedkit, hireCrew, gunStoreStock } from './activities.js';
import { saveGame, loadGame, hasSave } from './save.js';
import { SHOTS } from './shots.js';
import { dist } from './random.js';

const params = new URLSearchParams(window.location.search);
const seedParam = Number.parseInt(params.get('seed') || '20261124', 10);
const shotName = params.get('shot');
const selftest = params.get('selftest') === '1';

const canvas = document.getElementById('game');
const renderer = createRenderer(canvas);
const input = createInput(canvas);
const audio = createAudio();

let state = createWorld(seedParam);
let screen = SCREEN_TITLE;
let briefing = null;
let endTitle = '';
let endLines = [];
let hint = '';
let lastTime = performance.now();
let accumulator = 0;

if (shotName && SHOTS[shotName]) {
  state = SHOTS[shotName].stage(seedParam);
  screen = SHOTS[shotName].screen;
  snapCamera(state);
  renderer.draw(state, ui());
  window.__shotReady = true;
} else {
  // The headless self-test plays the live game, skipping the title screen.
  if (selftest) screen = SCREEN_PLAY;
  requestAnimationFrame(loop);
}

function ui() {
  return {
    screen,
    briefing,
    endTitle,
    endLines,
    hint,
    radio: audio.radioOn ? stationName(audio) : 'Radio off',
    hasSave: hasSave(),
  };
}

function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  accumulator += dt;
  while (accumulator >= STEP) {
    accumulator -= STEP;
    stepOnce();
  }
  renderer.draw(state, ui());
  if (selftest) selftestReport();
}

function stepOnce() {
  const snap = input.snapshot();
  const actions = input.takeActions();
  if (actions & ACTION_CONFIRM) startAudio(audio);

  // Aim follows the mouse in world space.
  const aim = renderer.screenToWorld(state, snap.mouseX, snap.mouseY);
  state.player.aimX = aim.x;
  state.player.aimY = aim.y;

  if (screen === SCREEN_TITLE) {
    if (actions & ACTION_CONFIRM) {
      if (hasSave()) loadGame(state);
      screen = SCREEN_PLAY;
      notify(state, 'Welcome back to Solmar Bay, Leo.');
    }
    return;
  }

  if (screen === SCREEN_PAUSED) {
    if (actions & ACTION_PAUSE || actions & ACTION_CONFIRM) screen = SCREEN_PLAY;
    return;
  }

  if (screen === SCREEN_BRIEFING) {
    if (actions & ACTION_CONFIRM) {
      startMission(state, briefing.index);
      screen = SCREEN_PLAY;
      briefing = null;
      saveGame(state);
    } else if (actions & ACTION_PAUSE) {
      screen = SCREEN_PLAY;
      briefing = null;
    }
    return;
  }

  if (screen === SCREEN_MISSION_END || screen === SCREEN_WASTED || screen === SCREEN_BUSTED) {
    if (actions & ACTION_CONFIRM) {
      if (screen === SCREEN_WASTED || screen === SCREEN_BUSTED) {
        state.player.alive = true;
        state.player.busted = false;
        state.player.health = 100;
        state.player.x = state.city.start.x;
        state.player.y = state.city.start.y;
        state.player.onFoot = true;
        state.player.inCar = null;
        snapCamera(state);
      }
      screen = SCREEN_PLAY;
    }
    return;
  }

  // ---- Playing ----
  if (actions & ACTION_PAUSE) {
    screen = SCREEN_PAUSED;
    saveGame(state);
    return;
  }
  if (actions & ACTION_WEAPON) cycleWeapon(state);
  if (actions & ACTION_RADIO) cycleStation(audio);
  if (actions & ACTION_ENTER_CAR) {
    if (state.player.onFoot) stealCar(state);
    else exitCar(state);
  }

  // Firing (on foot only; mouse down).
  if (snap.firing && state.player.onFoot && state.player.alive) {
    const fired = fireWeapon(state);
    if (fired) playGunshot(audio, state.player.weapon === 'shotgun');
  }

  // Context interactions.
  hint = '';
  const p = state.player;
  const garage = state.city.garage;
  const atMissionMarker = !state.mission && state.stats.missionsDone < 8
    && dist(p.x, p.y, garage.x + garage.w / 2, garage.y + garage.h / 2) < 120;
  if (atMissionMarker) {
    hint = 'E — Talk to Rosa (next job)';
    if (actions & ACTION_INTERACT) {
      briefing = { index: state.stats.missionsDone, def: MISSIONS[state.stats.missionsDone] };
      screen = SCREEN_BRIEFING;
      return;
    }
  } else if (atGarage(state) && !state.mission) {
    hint = 'E — Garage: respray $150 (clears wanted)  •  1 engine  2 armour';
    if (actions & ACTION_INTERACT) {
      if (respray(state)) notify(state, 'Fresh paint — the SBPD lost your trail.');
      else notify(state, 'Not enough cash for a respray.');
    }
  } else if (atGunStore(state)) {
    hint = 'E — Gun store: buy ammo  •  H — medkit $120';
    if (actions & ACTION_INTERACT) {
      const stock = gunStoreStock(state);
      const item = stock.find((s) => !s.locked);
      if (item && buyAmmo(state, item.weapon, item.rounds, item.price)) {
        notify(state, `Bought ${item.label}.`);
      } else notify(state, 'Nothing to buy — or not enough cash.');
    }
  } else if (state.city.taxiStands.some((s) => dist(p.x, p.y, s.x, s.y) < 120) && !state.taxi) {
    hint = 'E — Pick up a taxi fare';
    if (actions & ACTION_INTERACT) {
      const fare = startTaxiFare(state);
      if (fare) notify(state, `Fare accepted — $${fare.fare} if you make it in time.`);
    }
  }

  const events = stepWorld(state, STEP, snap);
  updateAudio(audio, state, STEP);

  if (events & EVENT_MISSION_PASSED) {
    const m = state.mission;
    endTitle = 'MISSION PASSED';
    endLines = [
      `${m.def.name} — job done.`,
      `+$${m.def.reward}  •  +${m.def.respect} respect`,
      state.stats.missionsDone + 1 >= 8 ? 'All eight jobs complete. Solmar Bay is yours, Leo.' : 'Rosa has more work when you are ready.',
    ];
    playCash(audio);
    completeMission(state);
    screen = SCREEN_MISSION_END;
    saveGame(state);
  } else if (events & EVENT_MISSION_FAILED) {
    const m = state.mission;
    endTitle = 'MISSION FAILED';
    endLines = [m.failReason || 'The job went sideways.', 'Talk to Rosa to try again.'];
    state.mission = null;
    state.rivals = [];
    screen = SCREEN_MISSION_END;
  } else if (events & EVENT_WASTED) {
    state.player.cash = Math.max(0, state.player.cash - 100);
    state.mission = null;
    state.rivals = [];
    screen = SCREEN_WASTED;
    saveGame(state);
  } else if (events & EVENT_BUSTED) {
    state.player.cash = Math.max(0, state.player.cash - 200);
    state.mission = null;
    state.rivals = [];
    screen = SCREEN_BUSTED;
    saveGame(state);
  }
}

let selftestDone = false;
function selftestReport() {
  if (selftestDone) return;
  if (state.time < 20) return;
  selftestDone = true;
  const el = document.getElementById('selftest');
  const cars = state.cars.length;
  const peds = state.peds.length;
  el.textContent = `SELFTEST OK cars=${cars} peds=${peds} time=${state.time.toFixed(1)}`;
  el.style.display = 'block';
  window.__selftestDone = true;
}

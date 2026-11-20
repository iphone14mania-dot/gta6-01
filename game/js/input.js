// Keyboard and mouse input. The game reads a plain input snapshot every
// step; one-shot actions (confirm, pause, enter car, shoot) are consumed once
// via takeActions, so a held key never double-fires a menu.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER_CAR = 4;
export const ACTION_FIRE = 8;
export const ACTION_WEAPON = 16;
export const ACTION_INTERACT = 32;
export const ACTION_RADIO = 64;
export const ACTION_MAP = 128;

const KEY_ACTIONS = {
  Enter: ACTION_CONFIRM,
  ' ': ACTION_CONFIRM,
  Escape: ACTION_PAUSE,
  KeyP: ACTION_PAUSE,
  KeyF: ACTION_ENTER_CAR,
  KeyQ: ACTION_WEAPON,
  KeyE: ACTION_INTERACT,
  KeyR: ACTION_RADIO,
  KeyM: ACTION_MAP,
};

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;

  function onKeyDown(event) {
    if (KEY_ACTIONS[event.code] !== undefined) actions |= KEY_ACTIONS[event.code];
    keys.add(event.code);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
  }
  function onKeyUp(event) {
    keys.delete(event.code);
  }
  function onMouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
  }
  function onMouseDown(event) {
    mouseDown = true;
    actions |= ACTION_FIRE | ACTION_CONFIRM;
    onMouseMove(event);
  }
  function onMouseUp() {
    mouseDown = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);

  return {
    /** Snapshot for this step: movement flags plus the mouse in screen pixels. */
    snapshot() {
      return {
        up: keys.has('KeyW') || keys.has('ArrowUp'),
        down: keys.has('KeyS') || keys.has('ArrowDown'),
        left: keys.has('KeyA') || keys.has('ArrowLeft'),
        right: keys.has('KeyD') || keys.has('ArrowRight'),
        run: keys.has('ShiftLeft') || keys.has('ShiftRight'),
        handbrake: keys.has('Space'),
        firing: mouseDown,
        mouseX,
        mouseY,
      };
    },
    /** One-shot actions since the last call; clears them. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    destroy() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
    },
  };
}

// Keyboard and mouse state. The game reads this, never the DOM events directly,
// so the screenshot autopilot can drive the same inputs.

export function createInput() {
  const keys = new Set();
  const pressed = new Set(); // keys pressed since the last poll, edge-triggered
  const input = {
    keys,
    mouseDX: 0,
    mouseDY: 0,
    mouseDown: false,
    mousePressed: false,
    pointerLocked: false,
    // virtual inputs the screenshot autopilot sets (OR-ed with the real ones)
    virtual: { keys: new Set(), mouseDX: 0, mouseDY: 0, mouseDown: false },
    down(code) {
      return keys.has(code) || input.virtual.keys.has(code);
    },
    wasPressed(code) {
      return pressed.has(code);
    },
    axis() {
      // forward/back and left/right from WASD or arrows, each -1..1
      let f = 0;
      let s = 0;
      if (input.down('KeyW') || input.down('ArrowUp')) f += 1;
      if (input.down('KeyS') || input.down('ArrowDown')) f -= 1;
      if (input.down('KeyA') || input.down('ArrowLeft')) s -= 1;
      if (input.down('KeyD') || input.down('ArrowRight')) s += 1;
      return { forward: f, strafe: s };
    },
    consumeMouse() {
      const dx = input.mouseDX + input.virtual.mouseDX;
      const dy = input.mouseDY + input.virtual.mouseDY;
      input.mouseDX = 0;
      input.mouseDY = 0;
      input.virtual.mouseDX = 0;
      input.virtual.mouseDY = 0;
      return { dx, dy };
    },
    firing() {
      return input.mouseDown || input.virtual.mouseDown;
    },
    endFrame() {
      pressed.clear();
      input.mousePressed = false;
    },
    attach(canvas) {
      window.addEventListener('keydown', (e) => {
        if (e.code === 'Space') e.preventDefault();
        if (!e.repeat) pressed.add(e.code);
        keys.add(e.code);
      });
      window.addEventListener('keyup', (e) => keys.delete(e.code));
      window.addEventListener('blur', () => keys.clear());
      document.addEventListener('mousemove', (e) => {
        if (document.pointerLockElement === canvas) {
          input.mouseDX += e.movementX;
          input.mouseDY += e.movementY;
        }
      });
      document.addEventListener('mousedown', (e) => {
        if (e.button === 0 && document.pointerLockElement === canvas) {
          input.mouseDown = true;
          input.mousePressed = true;
        }
      });
      document.addEventListener('mouseup', (e) => {
        if (e.button === 0) input.mouseDown = false;
      });
      document.addEventListener('pointerlockchange', () => {
        input.pointerLocked = document.pointerLockElement === canvas;
      });
    },
    lockPointer(canvas) {
      if (document.pointerLockElement !== canvas) {
        canvas.requestPointerLock();
      }
    },
  };
  return input;
}

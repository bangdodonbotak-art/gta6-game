// SOLMAR — keyboard + mouse input. Tracks held keys by code, mouse-drag orbit
// deltas for the camera, and edge-triggered "just pressed" keys for actions
// (enter car, punch, pause, mute) so one press never fires twice.
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressed = new Set();
    this.dragDX = 0;
    this.dragDY = 0;
    this.dragging = false;
    this.lastX = 0;
    this.lastY = 0;
    this.anyKey = false;

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressed.add(e.code);
      this.anyKey = true;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
    });

    canvas.addEventListener('pointerdown', (e) => {
      this.dragging = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!this.dragging) return;
      this.dragDX += e.clientX - this.lastX;
      this.dragDY += e.clientY - this.lastY;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    });
    const endDrag = () => {
      this.dragging = false;
    };
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);
  }

  down(code) {
    return this.keys.has(code);
  }

  // True once, on the frame after the key went down. Call once per frame per key.
  justPressed(code) {
    if (this.pressed.has(code)) {
      this.pressed.delete(code);
      return true;
    }
    return false;
  }

  // Camera orbit deltas accumulated since the last call, then cleared.
  consumeDrag() {
    const dx = this.dragDX;
    const dy = this.dragDY;
    this.dragDX = 0;
    this.dragDY = 0;
    return { dx, dy };
  }

  // Call at the end of every frame so unclaimed presses do not linger.
  endFrame() {
    this.pressed.clear();
  }
}

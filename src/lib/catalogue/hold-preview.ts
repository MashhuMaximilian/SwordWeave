/** Touch gesture shared by catalogue rows. Scrolling cancels the hold; a completed hold consumes only its synthetic click. */
export function createHoldPreview(
  onOpen: () => void,
  onCancel: () => void = () => {},
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let origin: { x: number; y: number } | null = null;
  let held = false;
  let blockUntil = 0;
  const clear = () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
  };
  return {
    start(x: number, y: number) {
      clear();
      origin = { x, y };
      held = false;
      blockUntil = 0;
      timer = setTimeout(() => {
        held = true;
        onOpen();
      }, 550);
    },
    move(x: number, y: number) {
      if (origin && Math.hypot(x - origin.x, y - origin.y) > 8) {
        clear();
        origin = null;
        if (held) onCancel();
        held = false;
        blockUntil = 0;
      }
    },
    end() {
      clear();
      if (held) blockUntil = Date.now() + 750;
      origin = null;
      held = false;
    },
    cancel() {
      clear();
      origin = null;
      held = false;
      blockUntil = 0;
    },
    consumeClick() {
      const consume = held || Date.now() < blockUntil;
      held = false;
      blockUntil = 0;
      return consume;
    },
    get active() {
      return origin !== null || held;
    },
  };
}

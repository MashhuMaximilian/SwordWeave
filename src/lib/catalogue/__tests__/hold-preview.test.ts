import { afterEach, describe, expect, it, vi } from "vitest";
import { createHoldPreview } from "../hold-preview";
afterEach(() => vi.useRealTimers());
describe("catalogue touch quick preview", () => {
  it("leaves a short tap available for the full preview", () => {
    vi.useFakeTimers();
    const open = vi.fn(),
      gesture = createHoldPreview(open);
    gesture.start(10, 10);
    vi.advanceTimersByTime(150);
    gesture.end();
    expect(gesture.consumeClick()).toBe(false);
    vi.advanceTimersByTime(1000);
    expect(open).not.toHaveBeenCalled();
  });
  it("opens after a hold and consumes just the resulting click", () => {
    vi.useFakeTimers();
    const open = vi.fn(),
      gesture = createHoldPreview(open);
    gesture.start(10, 10);
    vi.advanceTimersByTime(550);
    expect(open).toHaveBeenCalledOnce();
    // Keeping a finger down for several seconds must still avoid opening the full modal on release.
    vi.advanceTimersByTime(5000);
    gesture.end();
    expect(gesture.consumeClick()).toBe(true);
    expect(gesture.consumeClick()).toBe(false);
  });
  it("allows normal scrolling without opening a popover", () => {
    vi.useFakeTimers();
    const open = vi.fn(),
      gesture = createHoldPreview(open);
    gesture.start(10, 10);
    gesture.move(10, 30);
    vi.advanceTimersByTime(1000);
    gesture.end();
    expect(open).not.toHaveBeenCalled();
    expect(gesture.consumeClick()).toBe(false);
  });
  it("dismisses a held popover if the gesture becomes a scroll", () => {
    vi.useFakeTimers();
    const cancel = vi.fn(),
      gesture = createHoldPreview(vi.fn(), cancel);
    gesture.start(10, 10);
    vi.advanceTimersByTime(550);
    gesture.move(30, 30);
    expect(cancel).toHaveBeenCalledOnce();
    expect(gesture.consumeClick()).toBe(false);
  });
  it("cancels an interrupted gesture or an unmounted row", () => {
    vi.useFakeTimers();
    const open = vi.fn(),
      gesture = createHoldPreview(open);
    gesture.start(10, 10);
    gesture.cancel();
    vi.advanceTimersByTime(1000);
    expect(open).not.toHaveBeenCalled();
    expect(gesture.active).toBe(false);
  });
});

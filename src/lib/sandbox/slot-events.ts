// =============================================================================
// Sandbox slot event bus
//
// When the user is composing an effect / capability / template / item, they
// can also be browsing the Library column. The Library rows have a
// "Slot into build" action that drops the selected entry into the build
// they're currently composing, instead of loading it as a new editing row.
//
// We bridge this with a custom event:
//   - Library row click in the SandboxPreviewBody dispatches
//     `sw-sandbox-slot` with { kind, id, label }.
//   - The active form (EffectForm / CapabilityForm / TemplateForm / ItemForm)
//     listens for the event and forwards it to the appropriate add-function.
//
// Forms filter by `kind` (primitive, effect) — the user said:
//   - Primitives slot into effects, capabilities, templates, items.
//   - Effects slot into capabilities, templates.
//   - Capabilities slot into templates.
// =============================================================================

export type SlotKind = "primitive" | "effect" | "capability";

export interface SlotEvent {
  kind: SlotKind;
  /** primitiveId (number) when kind==="primitive", effectId (string) when
   *  kind==="effect", capabilityId (string) when kind==="capability". */
  id: number | string;
  label: string;
}

export const SLOT_EVENT_NAME = "sw-sandbox-slot";

export function dispatchSlot(event: SlotEvent) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<SlotEvent>(SLOT_EVENT_NAME, { detail: event }),
  );
}

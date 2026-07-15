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

// =============================================================================
// Sandbox open-preview event bus
//
// When the user clicks a slotted primitive / effect / capability inside the
// right-column form preview, we want to open that sub-entity's library
// preview modal — same affordance as clicking from the library list. We
// bridge this with a custom event so the form previews don't need to know
// anything about the modal-stack plumbing that lives in grammar-library /
// blueprint-library:
//
//   - Form preview click on a slotted item dispatches
//     `sw-sandbox-open-preview` with { targetType, targetId, label }.
//   - The library column listens for the event and pushes the appropriate
//     preview modal onto its modal stack. If no listener handles it, the
//     click is a no-op.
//
// targetType matches the canonical entity kinds (PRIMITIVE / EFFECT /
// CAPABILITY / ITEM / TEMPLATE_*) so we can reuse PreviewSubLink as the
// payload shape.
// =============================================================================

export interface OpenPreviewEvent {
  targetType: "PRIMITIVE" | "EFFECT" | "CAPABILITY" | "ITEM" | "TEMPLATE_RACE" | "TEMPLATE_CLASS" | "TEMPLATE_MONSTER" | "TEMPLATE_ITEM";
  targetId: string;
  label: string;
}

export const OPEN_PREVIEW_EVENT_NAME = "sw-sandbox-open-preview";

export function dispatchOpenPreview(event: OpenPreviewEvent) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<OpenPreviewEvent>(OPEN_PREVIEW_EVENT_NAME, {
      detail: event,
    }),
  );
}

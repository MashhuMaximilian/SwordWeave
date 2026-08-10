-- Phase 8.I POST A12: target_who override per bundle primitive link
-- Each primitive nested inside a capability or effect can be tagged
-- with `self`, `target`, or `scene`. The resolver excludes non-self
-- primitives from the character sheet (they only affect gameplay at
-- the table). BU budget is unaffected.

ALTER TABLE capability_primitives
  ADD COLUMN IF NOT EXISTS target_who text NOT NULL DEFAULT 'self'
  CHECK (target_who IN ('self', 'target', 'scene'));

ALTER TABLE effect_primitives
  ADD COLUMN IF NOT EXISTS target_who text NOT NULL DEFAULT 'self'
  CHECK (target_who IN ('self', 'target', 'scene'));

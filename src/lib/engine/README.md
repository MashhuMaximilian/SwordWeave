# SwordWeave Engine

Pure TypeScript evaluation code lives here.

Planned modules:

- `bu`: total BU ledgers and budget validation.
- `stats`: dynamic DC and live stat compilation.
- `modifiers`: primitive hard modifier evaluation.
- `capabilities`: capability value compilation from verbs, domains, effects, and slotted primitives.

This folder should stay framework-agnostic. Next.js pages, Server Actions, and database adapters call into this layer rather than owning SwordWeave math directly.

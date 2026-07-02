# SwordWeave Web Engine

SwordWeave is a modular tabletop RPG engine where every character, capability, effect, item, monster, heritage, and background is composed from one shared library of atomic Primitives.

## Bootstrap Commands

```bash
npm install
npm run typecheck
npm run lint
npm run dev
```

## Project Structure

```text
/Users/max/dev/SwordWeave
├── src
│   ├── app
│   │   └── actions
│   ├── components
│   │   ├── cards
│   │   │   ├── capability
│   │   │   ├── effect
│   │   │   ├── item
│   │   │   └── monster
│   │   ├── layout
│   │   ├── sheet
│   │   │   └── character
│   │   └── ui
│   ├── db
│   │   ├── migrations
│   │   └── schema
│   ├── hooks
│   ├── lib
│   │   └── engine
│   └── types
└── components.json
```

## Architecture Rule

`Primitive` is the atomic brick. It owns its BU cost, category, and hard modifier directives. Effects group primitives, capabilities compose verbs/domains/effects, and entities are ledgers of owned or slotted primitives.

# SwordWeave Web Engine

SwordWeave is a modular tabletop RPG engine where every character, capability, effect, item, monster, heritage, and background is composed from one shared library of atomic Primitives.

## Bootstrap Commands

```bash
npm install
npm run typecheck
npm run lint
npm run dev
```

Copy `.env.example` to `.env.local` and fill in the generated Neon and Clerk
values before using protected routes or account-owned writes.

## Auth

SwordWeave uses Clerk for authentication. The public sandbox can still be
browsed while signed out, but saving primitives, importing primitive packages,
creating effects, and account ledger routes require sign-in.

Required environment variables:

```text
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/
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

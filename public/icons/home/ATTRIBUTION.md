# Homepage icons

Original white silhouettes downloaded from the official [game-icons.net](https://game-icons.net/) collection on 22 October 2026:

- [Cube](https://game-icons.net/1x1/delapouite/cube.html) by Delapouite.
- [Fire shield](https://game-icons.net/1x1/lorc/fire-shield.html), [Rune sword](https://game-icons.net/1x1/lorc/rune-sword.html), [DNA](https://game-icons.net/1x1/lorc/dna1.html), and [Knapsack](https://game-icons.net/1x1/lorc/knapsack.html) by Lorc.

Licensed under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). Attribution also remains on the website's `/attributions` page.

The unmodified white silhouettes are used as CSS masks. The `*-metallic.svg` variants are derived with the same `metallicSvg` function and exact hues already used by the runtime proxy. Regenerate with `pnpm exec tsx scripts/generate-home-icons.ts`; `--check` verifies them without changing files. Only these five fixed homepage icons use the bundled files; user-authored icon variants continue to use the existing proxy.

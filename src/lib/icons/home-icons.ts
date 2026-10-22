/** Fixed, attributed homepage artwork; user-authored icons keep the runtime proxy. */
export const HOME_ICONS = {
  "delapouite/cube": { slug: "cube", color: "#f6dc9d" },
  "lorc/fire-shield": { slug: "fire-shield", color: "#efb88e" },
  "lorc/rune-sword": { slug: "rune-sword", color: "#94e9d8" },
  "lorc/dna1": { slug: "dna1", color: "#f6dc9d" },
  "lorc/knapsack": { slug: "knapsack", color: "#e2e6de" },
} as const;

export type HomeIconKey = keyof typeof HOME_ICONS;

export function homeIconSources(key: HomeIconKey) {
  const { slug } = HOME_ICONS[key];
  return {
    mask: `/icons/home/${slug}.svg`,
    metallic: `/icons/home/${slug}-metallic.svg`,
  };
}

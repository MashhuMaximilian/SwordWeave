import { IconDisplay } from "@/components/icons/icon-display";
import type { CSSProperties } from "react";

const FAB_ICON_COLOR_LIGHT = "#011614";
const FAB_ICON_COLOR_DARK = "#ffffff";
const FAB_ICON_GOLD_LIGHT = "#76622f";
const FAB_ICON_GOLD_DARK = "#d3aa61";

export function FabThemeIcon({
  iconKey,
  dark,
}: {
  iconKey: string;
  dark: boolean;
}) {
  const [author, slug] = iconKey.split("/", 2);
  const maskUrl = `/api/icons/game/${encodeURIComponent(author ?? "")}/${encodeURIComponent(slug ?? "")}?color=%23ffffff`;

  return (
    <span
      className="sw-fab__theme-icon"
      aria-hidden="true"
      style={{ "--sw-fab-icon-mask": `url("${maskUrl}")` } as CSSProperties}
    >
      <IconDisplay
        iconSource="GAME_ICONS"
        iconKey={iconKey}
        iconColor={dark ? FAB_ICON_COLOR_DARK : FAB_ICON_COLOR_LIGHT}
        size={22}
        alt=""
        className="sw-fab__theme-icon-default"
      />
      <IconDisplay
        iconSource="GAME_ICONS"
        iconKey={iconKey}
        iconColor={dark ? FAB_ICON_GOLD_DARK : FAB_ICON_GOLD_LIGHT}
        size={22}
        alt=""
        className="sw-fab__theme-icon-gold"
      />
      <span className="sw-fab__theme-icon-metal" />
    </span>
  );
}

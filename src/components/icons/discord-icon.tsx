import styles from "./discord-icon.module.css";

// Official Discord symbol: https://discord.com/branding
// The downloaded SVG remains unchanged; the mask inherits the link's finish.
export function DiscordIcon() {
  return <span className={styles["icon"]} data-discord-icon aria-hidden="true" />;
}

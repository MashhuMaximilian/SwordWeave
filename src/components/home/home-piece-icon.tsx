import { homeIconSources, type HomeIconKey } from "@/lib/icons/home-icons";

/** Same IconDisplay image markup/finish, served without an icon-proxy request. */
export function HomePieceIcon({ iconKey }: { iconKey: HomeIconKey }) {
  return <img src={homeIconSources(iconKey).metallic} alt="" width={38} height={38}
    loading="lazy" className="sw-entity-icon inline-block shrink-0" style={{ width: 38, height: 38 }} />;
}

import { SWORDWEAVE_RELEASE } from "@/lib/release";

export function ReleaseBadge() {
  return <span className="sw-release-badge" aria-label={`SwordWeave ${SWORDWEAVE_RELEASE}`}>{SWORDWEAVE_RELEASE}</span>;
}

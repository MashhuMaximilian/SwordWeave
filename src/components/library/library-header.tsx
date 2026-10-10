import type { ReactNode } from "react";
import { LibraryGroupNav } from "./library-group-nav";
import "./library-header.css";

export function LibraryHeader({ active, action }: { active: string; action?: ReactNode }) {
  return <header className="sw-library-header">
    <div className="sw-library-header-intro">
      <div><p className="v12-kicker">The shared Library</p><h1>The SwordWeave Library</h1></div>
      <p className="sw-library-header-description">Discover rules, characters, creatures and encounters. Browse public entries, your own work and creations shared by people you follow.</p>
      {action && <div className="sw-library-header-action">{action}</div>}
    </div>
    <LibraryGroupNav active={active}/>
  </header>;
}

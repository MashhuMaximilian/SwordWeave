import type { ReactNode } from "react";

export function LibrarySourceRecord({ title, icon, description, metadata, badge, actions }: {
  title: string;
  icon: ReactNode;
  description: ReactNode;
  metadata: ReactNode;
  badge?: ReactNode;
  actions: ReactNode;
}) {
  return <>
    <span className="sw-entity-medallion sw-source-record-icon" aria-hidden="true">{icon}</span>
    <div className="sw-source-record-copy">
      <h3>{title}</h3>
      {description && <div className="sw-source-record-rule">{description}</div>}
      <div className="sw-source-record-meta">{metadata}</div>
    </div>
    <div className="sw-source-record-end">
      {badge}
      <div className="sw-source-record-actions">{actions}</div>
    </div>
  </>;
}

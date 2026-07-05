// =============================================================================
// <EmptyState> — shared empty/zero-state component
//
// Use for any list/grid that may render zero items: library results,
// profile libraries, forks, reactions, follows, search results.
//
// Supports an icon, headline, body, primary CTA, and an optional
// secondary CTA. CTA accepts either an internal route (Href) or an
// onClick handler. Keep tone helpful — "no data yet" beats "nothing here".
// =============================================================================

import Link from "next/link";
import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  primaryAction?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  secondaryAction?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  /** Render a tighter padding variant for inline use (e.g. under filters) */
  compact?: boolean;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={[
        "rounded-md border border-dashed border-border bg-card/40 text-center",
        compact ? "px-4 py-8" : "px-6 py-14",
      ].join(" ")}
      data-testid="empty-state"
    >
      {Icon ? (
        <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Icon className="size-5" aria-hidden="true" />
        </div>
      ) : null}
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {description ? (
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
      ) : null}
      {(primaryAction || secondaryAction) && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {primaryAction ? <Action {...primaryAction} primary /> : null}
          {secondaryAction ? <Action {...secondaryAction} /> : null}
        </div>
      )}
    </div>
  );
}

function Action({
  label,
  href,
  onClick,
  primary = false,
}: {
  label: string;
  href?: string;
  onClick?: () => void;
  primary?: boolean;
}) {
  const cls = primary
    ? "rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
    : "rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent";

  if (href) {
    return (
      <Link href={href} className={cls}>
        {label}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      {label}
    </button>
  );
}
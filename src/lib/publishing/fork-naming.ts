// =============================================================================
// fork-naming — unique-name computation for forks
//
// Forking appends " (fork)" to the source name, but re-forking the same
// source collides on the per-(name, user) unique constraint for primitives
// and the per-(name, source_origin) constraint for capabilities/effects/items.
// We resolve that by appending a numeric suffix: " (fork)", " (fork 2)",
// " (fork 3)", ...
//
// The function takes a "nameExists" predicate the caller provides so we stay
// schema-agnostic (the constraint columns differ between entity tables).
// =============================================================================

export const FORK_SUFFIX = " (fork)";

/**
 * Compute a fork name that doesn't collide with anything `nameExists` returns
 * true for. Starts from `baseName + FORK_SUFFIX` and walks
 * `baseName + FORK_SUFFIX + " 2"`, `... + " 3"`, ...
 *
 * The predicate runs synchronously when sync; we delegate to async only if
 * the predicate itself returns a Promise (it does, since it hits the DB).
 *
 * The DB's unique constraint is the source of truth — the predicate is a
 * best-effort pre-flight. Concurrent forks can still race; callers should
 * retry on Postgres 23505.
 */
export async function computeUniqueForkName(
  baseName: string,
  nameExists: (candidate: string) => boolean | Promise<boolean>,
): Promise<string> {
  const firstCandidate = `${baseName}${FORK_SUFFIX}`;
  if (!(await nameExists(firstCandidate))) return firstCandidate;
  // Walk numeric suffixes. Cap at 999 to avoid pathological loops; if we
  // somehow get there, fall back to a UUID-derived suffix (which guarantees
  // uniqueness against the pre-flight predicate).
  for (let n = 2; n < 1000; n++) {
    const candidate = `${baseName}${FORK_SUFFIX} ${n}`;
    if (!(await nameExists(candidate))) return candidate;
  }
  return `${baseName}${FORK_SUFFIX} ${crypto.randomUUID().slice(0, 8)}`;
}

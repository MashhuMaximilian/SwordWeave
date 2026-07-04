ALTER TABLE "primitives" ALTER COLUMN "cost_tier" SET DEFAULT 'Tier 1: Minor (4 BU anchor)';--> statement-breakpoint
ALTER TABLE "entities" DROP COLUMN "presence";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { EntityKey } from "@/lib/character/workspace/model";
import { bustResolverCache } from "@/lib/cache/character-resolver-cache";
import {
  applyCharacterConsequencePackage,
  consequencePackageApplySchema,
  consequencePackageKeySchema,
  readCharacterConsequencePackage,
} from "@/lib/character/consequences/apply-package";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth.protect();
  const { id } = await params;
  try {
    const key = consequencePackageKeySchema.parse(
      new URL(request.url).searchParams.get("key"),
    ) as EntityKey;
    return NextResponse.json(await readCharacterConsequencePackage(id, userId, key));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Preview failed." },
      { status: 400 },
    );
  }
}
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth.protect();
  const { id } = await params;
  try {
    const body = consequencePackageApplySchema.parse(await request.json());
    const result = await applyCharacterConsequencePackage(id, userId, body);
    bustResolverCache(id);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Application failed." },
      { status: 400 },
    );
  }
}

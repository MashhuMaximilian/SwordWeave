import { NextResponse, type NextRequest } from "next/server";
import { listPrimitiveFamilyTiers } from "@/lib/publishing/library-query";
export async function GET(request: NextRequest) {
  const category = request.nextUrl.searchParams.get("category")?.trim() ?? "";
  if (!category || category.length > 100) return NextResponse.json({ tiers: [] });
  try { return NextResponse.json({ tiers: await listPrimitiveFamilyTiers(category) }); }
  catch { return NextResponse.json({ error: "Unable to load the family ladder." }, { status: 500 }); }
}

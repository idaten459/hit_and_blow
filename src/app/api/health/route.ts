import { NextResponse } from "next/server";
import { buildHealthReport } from "@/lib/health";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  return NextResponse.json(buildHealthReport(), {
    headers: {
      "Cache-Control": "no-store, max-age=0"
    }
  });
}

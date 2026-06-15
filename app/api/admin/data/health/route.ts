import { NextResponse } from "next/server";
import { getDataLayerHealth } from "@/lib/db/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({
      status: "ok",
      dataLayer: getDataLayerHealth(),
      servedAt: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        message: error instanceof Error ? error.message : "Data layer unavailable",
        servedAt: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

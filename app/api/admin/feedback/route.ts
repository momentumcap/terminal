import { getBetaFeedbackSummary } from "@/lib/db/repository";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({
      status: "ok",
      feedback: getBetaFeedbackSummary(50),
      servedAt: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        message: error instanceof Error ? error.message : "Feedback summary unavailable",
        servedAt: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

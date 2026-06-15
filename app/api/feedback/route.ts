import { createBetaFeedbackReport, listBetaFeedbackReports } from "@/lib/db/repository";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const feedbackSchema = z.object({
  category: z.enum(["bad_data", "missing_data", "wrong_risk", "ui_bug", "performance", "feature_request", "other"]),
  severity: z.enum(["low", "medium", "high", "critical"]),
  tokenAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional().nullable(),
  pageUrl: z.string().max(600).optional().nullable(),
  title: z.string().trim().min(5).max(140),
  details: z.string().trim().min(15).max(4000),
  expectedResult: z.string().trim().max(1200).optional().nullable(),
  stepsToReproduce: z.string().trim().max(1600).optional().nullable(),
  contact: z.string().trim().max(200).optional().nullable(),
  context: z.record(z.string(), z.unknown()).optional()
});

export async function GET(request: NextRequest) {
  const limit = Number(request.nextUrl.searchParams.get("limit") ?? 50);
  return NextResponse.json({
    reports: listBetaFeedbackReports(Number.isFinite(limit) ? limit : 50),
    servedAt: new Date().toISOString()
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = feedbackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid feedback report",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message
        }))
      },
      { status: 400 }
    );
  }

  const report = createBetaFeedbackReport({
    ...parsed.data,
    userAgent: request.headers.get("user-agent"),
    tokenAddress: parsed.data.tokenAddress?.toLowerCase() ?? null
  });
  return NextResponse.json({ report }, { status: 201 });
}

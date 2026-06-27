import { realtimeJson } from "@/lib/apiResponse";
import { runFreshnessWarmup, startFreshnessService } from "@/lib/indexer/freshnessService";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const cookie = request.headers.get("cookie") ?? "";
  const internalHeaders = cookie ? { cookie } : undefined;
  try {
    startFreshnessService({ intervalMs: 30_000, marketLimit: 10 });
    const [warmup, providers, trust] = await Promise.all([
      runFreshnessWarmup({ marketLimit: 10 }),
      fetch(`${origin}/api/health/providers`, { cache: "no-store", headers: internalHeaders }).then(async (response) => {
        if (!response.ok) throw new Error(`provider health ${response.status}`);
        return response.json();
      }),
      fetch(`${origin}/api/trust/summary`, { cache: "no-store", headers: internalHeaders }).then(async (response) => {
        if (!response.ok) throw new Error(`trust summary ${response.status}`);
        return response.json();
      })
    ]);

    return realtimeJson({
      status: "ok",
      message: "Status refreshed and freshness warmup triggered.",
      freshness: warmup,
      providers: providers.summary ?? null,
      trust: trust.trust ?? null
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        message: error instanceof Error ? error.message : "Status refresh failed",
        servedAt: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

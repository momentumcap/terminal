import { NextResponse } from "next/server";

export const REALTIME_HEADERS = {
  "Cache-Control": "no-store, max-age=0, must-revalidate",
  Pragma: "no-cache",
  Expires: "0"
};

export function realtimeJson<T extends Record<string, unknown>>(body: T, init?: ResponseInit) {
  return NextResponse.json(
    {
      ...body,
      servedAt: new Date().toISOString()
    },
    {
      ...init,
      headers: {
        ...REALTIME_HEADERS,
        ...(init?.headers ?? {})
      }
    }
  );
}

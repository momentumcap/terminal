"use client";

import { Line, LineChart, ResponsiveContainer } from "recharts";

export function SparklineChart({ data, positive = true }: { data: number[]; positive?: boolean }) {
  const points = data.map((value, index) => ({ index, value }));
  return (
    <div className="h-10 w-24">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points}>
          <Line type="monotone" dataKey="value" dot={false} stroke={positive ? "#43d17a" : "#ff5d5d"} strokeWidth={2} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

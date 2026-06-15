import { RouteLoading } from "@/components/system/RouteLoading";

export default function AccuracyLoading() {
  return (
    <RouteLoading
      title="Loading Accuracy Dashboard"
      subtitle="Checking provider health, stale data, source disagreement, cache telemetry, and beta readiness."
      variant="accuracy"
    />
  );
}

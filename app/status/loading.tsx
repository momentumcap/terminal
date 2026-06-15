import { RouteLoading } from "@/components/system/RouteLoading";

export default function StatusLoading() {
  return (
    <RouteLoading
      title="Loading Terminal Status"
      subtitle="Checking provider health, stale data, source disagreement, and trust warnings."
      variant="accuracy"
    />
  );
}

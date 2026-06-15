import { RouteLoading } from "@/components/system/RouteLoading";

export default function AdminBetaLoading() {
  return (
    <RouteLoading
      title="Loading Public Beta Checklist"
      subtitle="Checking launch readiness, feedback triage, data quality, holder coverage, and alert accountability."
      variant="accuracy"
    />
  );
}

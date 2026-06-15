import { RouteLoading } from "@/components/system/RouteLoading";

export default function AdminFeedbackLoading() {
  return (
    <RouteLoading
      title="Loading Feedback Triage"
      subtitle="Preparing public beta reports, severity mix, affected tokens, and reproduction details."
      variant="accuracy"
    />
  );
}

import { StubPage } from "@/components/StubPage";

export default function Dispatch() {
  return (
    <StubPage
      title="Dispatch"
      description="Brief a flight before taking off in MSFS. A dispatch in 'flying' state is required for sim-bridge to persist the landing."
      nextSteps={[
        "Form: flight_number, origin/dest ICAO, aircraft, pax eco/biz, cruise alt",
        "Optional: import SimBrief OFP into ofp_data",
        "Action: set status to 'flying' when you board in MSFS",
        "List of active & past dispatches with status badges",
      ]}
    />
  );
}

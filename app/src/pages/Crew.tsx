import { StubPage } from "@/components/StubPage";

export default function Crew() {
  return (
    <StubPage
      title="Crew"
      description="Hire captains and first officers, assign them to aircraft, and watch their duty hours."
      nextSteps={[
        "Hire modal with generated name + starting stats",
        "Assign to aircraft_id via dropdown",
        "Duty hours progress vs max_duty_h (80h) with resting rotation",
      ]}
    />
  );
}

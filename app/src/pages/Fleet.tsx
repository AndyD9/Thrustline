import { StubPage } from "@/components/StubPage";

export default function Fleet() {
  return (
    <StubPage
      title="Fleet"
      description="Browse, acquire and lease aircraft. Monitor health, cycles and hours."
      nextSteps={[
        "List aircraft from supabase.from('aircraft') filtered by company_id",
        "CRUD : acquire (insert), sell (delete), retire",
        "Health bar + cycles/hours gauge per aircraft",
      ]}
    />
  );
}

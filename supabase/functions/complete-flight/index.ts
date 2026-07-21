import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

type LandingPayload = {
  operationId: string;
  distanceNm: number;
  fuelUsedGal: number;
  durationMin: number;
  landingVsFpm: number;
  paxSatisfaction?: number;
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

function validNumber(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json(405, { error: "method_not_allowed" });
  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
    console.error("complete-flight: missing Supabase server configuration");
    return json(503, { error: "service_unavailable" });
  }

  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) return json(401, { error: "unauthorized" });
  const accessToken = authorization.slice("Bearer ".length).trim();

  const authClient = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await authClient.auth.getUser(accessToken);
  if (userError || !userData.user) return json(401, { error: "unauthorized" });

  let payload: LandingPayload;
  try {
    payload = await request.json();
  } catch {
    return json(400, { error: "invalid_json" });
  }

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(payload.operationId) ||
    !validNumber(payload.distanceNm, 0, 20_000) ||
    !validNumber(payload.fuelUsedGal, 0, 100_000) ||
    !validNumber(payload.durationMin, 1, 1_440) ||
    !validNumber(payload.landingVsFpm, -3_000, 3_000) ||
    (payload.paxSatisfaction !== undefined && !validNumber(payload.paxSatisfaction, 0, 100))
  ) return json(422, { error: "invalid_landing_payload" });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await admin.rpc("complete_player_flight", {
    p_operation_id: payload.operationId,
    p_user_id: userData.user.id,
    p_payload: {
      distanceNm: payload.distanceNm,
      fuelUsedGal: payload.fuelUsedGal,
      durationMin: Math.round(payload.durationMin),
      landingVsFpm: payload.landingVsFpm,
      paxSatisfaction: payload.paxSatisfaction,
    },
  });

  if (error) {
    console.error("complete-flight RPC failed", { code: error.code, userId: userData.user.id });
    const conflict = error.message.includes("already completed") || error.message.includes("No flying dispatch");
    return json(conflict ? 409 : 500, { error: conflict ? "flight_not_completable" : "operation_failed" });
  }
  return json(200, data);
});

import { supabase } from "@/lib/supabase";

export type PassiveAdvanceResult = { started: number; completed: number };

export async function advancePassiveOperations(): Promise<PassiveAdvanceResult> {
  const result = { started: 0, completed: 0 };
  // Each database call can complete one due leg and unlock/start the next one.
  // Repeating while work is reported catches up an entire elapsed rotation.
  for (let pass = 0; pass < 100; pass += 1) {
    const invoke = supabase.rpc.bind(supabase) as unknown as (
      fn: string,
      args?: Record<string, never>,
    ) => Promise<{ data: { started: number; completed: number }[] | null; error: { message: string } | null }>;
    const { data, error } = await invoke("advance_passive_schedules");
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    const started = Number(row?.started ?? 0);
    const completed = Number(row?.completed ?? 0);
    result.started += started;
    result.completed += completed;
    if (started === 0 && completed === 0) break;
  }
  return result;
}

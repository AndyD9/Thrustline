import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";

/**
 * Hook générique qui subscribe aux changements Realtime d'une table Supabase
 * et merge les INSERT/UPDATE/DELETE dans un state local.
 *
 * Prérequis : la table doit avoir Realtime activé dans Supabase Dashboard
 * (Database → Replication → cocher la table).
 *
 * @param table    Nom de la table Supabase (ex: "companies", "flights")
 * @param filter   Filtre Realtime (ex: "company_id=eq.xxxx")
 * @param initial  Données initiales (chargées par un select au mount)
 * @param getId    Fonction pour extraire l'id d'une row (default: r.id)
 *
 * @example
 *   const { data, setData } = useRealtimeTable<Flight>({
 *     table: "flights",
 *     filter: `company_id=eq.${company.id}`,
 *     initial: flights,
 *   });
 */
export function useRealtimeTable<T extends Record<string, unknown>>({
  table,
  filter,
  initial,
  getId = (r) => r.id as string,
  enabled = true,
}: {
  table: string;
  filter?: string;
  initial: T[];
  getId?: (row: T) => string;
  enabled?: boolean;
}) {
  const [data, setData] = useState<T[]>(initial);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Sync when initial data changes (e.g. after a manual fetch)
  useEffect(() => {
    setData(initial);
  }, [initial]);

  useEffect(() => {
    if (!enabled) return;

    const channelName = filter ? `${table}:${filter}` : table;

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes" as "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          ...(filter ? { filter } : {}),
        },
        (payload: RealtimePostgresChangesPayload<T>) => {
          switch (payload.eventType) {
            case "INSERT":
              setData((prev) => [payload.new as T, ...prev]);
              break;
            case "UPDATE":
              setData((prev) =>
                prev.map((row) =>
                  getId(row) === getId(payload.new as T) ? (payload.new as T) : row,
                ),
              );
              break;
            case "DELETE":
              setData((prev) =>
                prev.filter((row) => getId(row) !== getId(payload.old as T)),
              );
              break;
          }
        },
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [table, filter, enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  return { data, setData };
}

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import type { Company } from "@/lib/database.types";

export interface UseCompanyResult {
  company: Company | null;
  loading: boolean;
  refetch: () => Promise<void>;
}

/**
 * Charge la compagnie de l'utilisateur connecté (1 par user).
 * Retourne null pendant le chargement ou si aucune compagnie n'existe encore.
 */
export function useCompany(): UseCompanyResult {
  const { user } = useAuth();
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchCompany() {
    if (!user) {
      setCompany(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("companies")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) {
      // eslint-disable-next-line no-console
      console.error("[useCompany] fetch failed:", error);
      setCompany(null);
    } else {
      setCompany(data as Company | null);
    }
    setLoading(false);
  }

  useEffect(() => {
    void fetchCompany();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return { company, loading, refetch: fetchCompany };
}

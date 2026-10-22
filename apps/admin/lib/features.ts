import type { SupabaseClient } from "@supabase/supabase-js";
import { academyFeaturesRowSchema, isFeatureKey, type FeatureKey } from "@dojo/contracts/features";

// Pacotes por academia (ver supabase/migrations/..._academy_plans.sql). O banco barra a CRIAÇÃO de dados de funcionalidades desligadas;
// aqui a tela deixa de oferecer o que o pacote não inclui. Sem acesso à academia, não se bloqueia por engano: a autorização da própria
// página e do banco continuam valendo.

/** A academia tem a funcionalidade? (`true` quando não dá para saber, para a página responder pela sua própria autorização.) */
export async function academyHas(supabase: SupabaseClient, academyId: string, feature: FeatureKey): Promise<boolean> {
  const { data, error } = await supabase.rpc("academy_features", { p_academy_id: academyId });
  if (error) return true;
  return Array.isArray(data) && data.includes(feature);
}

/** Funcionalidades ligadas em cada academia onde a pessoa tem papel (membro, gestor ou responsável). */
export async function myFeatureMap(supabase: SupabaseClient): Promise<Map<string, Set<FeatureKey>>> {
  const { data } = await supabase.rpc("my_academy_features");
  const map = new Map<string, Set<FeatureKey>>();
  for (const row of (data ?? []) as unknown[]) {
    const parsed = academyFeaturesRowSchema.safeParse(row);
    if (parsed.success) map.set(parsed.data.academy_id, new Set(parsed.data.features.filter(isFeatureKey)));
  }
  return map;
}

/** Academias (da lista dada) que têm a funcionalidade. */
export const academiesWith = (map: Map<string, Set<FeatureKey>>, ids: string[], feature: FeatureKey) => ids.filter((id) => map.get(id)?.has(feature));

/** Alguma das academias da pessoa tem a funcionalidade? */
export const anyAcademyHas = (map: Map<string, Set<FeatureKey>>, feature: FeatureKey) => [...map.values()].some((set) => set.has(feature));

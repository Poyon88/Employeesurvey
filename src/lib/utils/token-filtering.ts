import { SupabaseClient } from "@supabase/supabase-js";
import { SurveyFilters } from "@/lib/types";

export type TokenWithDemographics = {
  id: string;
  token: string;
  email: string | null;
  employee_name: string | null;
  societe_id: string | null;
  direction_id: string | null;
  department_id: string | null;
  service_id: string | null;
  sexe: string | null;
  date_naissance: string | null;
  date_entree: string | null;
  fonction: string | null;
  lieu_travail: string | null;
  type_contrat: string | null;
  temps_travail: string | null;
  cost_center: string | null;
};

/**
 * Builds a Supabase query with all simple (DB-level) filters applied.
 * Age and seniority ranges are handled in JS after fetching.
 */
export function buildTokenFilterQuery(
  admin: SupabaseClient,
  filters: SurveyFilters,
  options?: { includeDemographics?: boolean }
) {
  const baseCols = "id, token, email, employee_name, societe_id, direction_id, department_id, service_id";
  const demoCols = ", sexe, date_naissance, date_entree, fonction, lieu_travail, type_contrat, temps_travail, cost_center";
  const selectCols = options?.includeDemographics === false ? baseCols : baseCols + demoCols;

  let query = admin
    .from("anonymous_tokens")
    .select(selectCols)
    .eq("active", true);

  if (filters.societe_ids && filters.societe_ids.length > 0) {
    query = query.in("societe_id", filters.societe_ids);
  }
  if (filters.direction_ids && filters.direction_ids.length > 0) {
    query = query.in("direction_id", filters.direction_ids);
  }
  if (filters.department_ids && filters.department_ids.length > 0) {
    query = query.in("department_id", filters.department_ids);
  }
  if (filters.service_ids && filters.service_ids.length > 0) {
    query = query.in("service_id", filters.service_ids);
  }
  if (filters.sexe && filters.sexe.length > 0) {
    query = query.in("sexe", filters.sexe);
  }
  if (filters.fonctions && filters.fonctions.length > 0) {
    query = query.in("fonction", filters.fonctions);
  }
  if (filters.lieux_travail && filters.lieux_travail.length > 0) {
    query = query.in("lieu_travail", filters.lieux_travail);
  }
  if (filters.types_contrat && filters.types_contrat.length > 0) {
    query = query.in("type_contrat", filters.types_contrat);
  }
  if (filters.temps_travail && filters.temps_travail.length > 0) {
    query = query.in("temps_travail", filters.temps_travail);
  }
  if (filters.cost_centers && filters.cost_centers.length > 0) {
    query = query.in("cost_center", filters.cost_centers);
  }

  return query;
}

/**
 * Calculates age in years from a date string (YYYY-MM-DD).
 */
function calculateYearsDiff(dateStr: string): number {
  const date = new Date(dateStr);
  const now = new Date();
  let years = now.getFullYear() - date.getFullYear();
  const monthDiff = now.getMonth() - date.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < date.getDate())) {
    years--;
  }
  return years;
}

/**
 * Filters tokens by age and seniority ranges (calculated from date_naissance/date_entree).
 * These cannot be done in the DB query since they require date arithmetic.
 */
export function filterByAgeAndSeniority(
  tokens: TokenWithDemographics[],
  filters: SurveyFilters
): TokenWithDemographics[] {
  const hasAgeFilter =
    filters.age_min !== undefined || filters.age_max !== undefined;
  const hasSeniorityFilter =
    filters.seniority_min !== undefined || filters.seniority_max !== undefined;

  if (!hasAgeFilter && !hasSeniorityFilter) return tokens;

  return tokens.filter((t) => {
    // Age filter
    if (hasAgeFilter && t.date_naissance) {
      const age = calculateYearsDiff(t.date_naissance);
      if (filters.age_min !== undefined && age < filters.age_min) return false;
      if (filters.age_max !== undefined && age > filters.age_max) return false;
    } else if (hasAgeFilter && !t.date_naissance) {
      // If age filter is active but no birth date, exclude
      return false;
    }

    // Seniority filter
    if (hasSeniorityFilter && t.date_entree) {
      const seniority = calculateYearsDiff(t.date_entree);
      if (filters.seniority_min !== undefined && seniority < filters.seniority_min)
        return false;
      if (filters.seniority_max !== undefined && seniority > filters.seniority_max)
        return false;
    } else if (hasSeniorityFilter && !t.date_entree) {
      return false;
    }

    return true;
  });
}

/**
 * Gets all filtered tokens by combining DB-level filters and JS-level age/seniority filters.
 */
export async function getFilteredTokens(
  admin: SupabaseClient,
  filters: SurveyFilters
): Promise<TokenWithDemographics[]> {
  const query = buildTokenFilterQuery(admin, filters);
  const { data, error } = await query;

  if (error) {
    // If the error is due to missing demographic columns, retry without them
    if (error.message?.includes("column") || error.code === "42703") {
      const fallbackQuery = buildTokenFilterQuery(admin, filters, { includeDemographics: false });
      const { data: fallbackData, error: fallbackError } = await fallbackQuery;
      if (fallbackError) {
        throw new Error(`Error fetching tokens: ${fallbackError.message}`);
      }
      return (fallbackData || []) as unknown as TokenWithDemographics[];
    }
    throw new Error(`Error fetching tokens: ${error.message}`);
  }

  const tokens = (data || []) as unknown as TokenWithDemographics[];
  return filterByAgeAndSeniority(tokens, filters);
}

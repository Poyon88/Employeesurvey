import { TokenWithDemographics } from "./token-filtering";

type StrataDimension = {
  key: keyof TokenWithDemographics;
  values: Set<string>;
};

/**
 * Stratified proportional sampling algorithm.
 *
 * 1. Detects available dimensions (>10% of population has data)
 * 2. Limits to 3 dimensions max (prioritizes dimensions with fewest distinct values)
 * 3. Groups tokens into strata (unique combinations of dimension values)
 * 4. Proportional allocation with largest remainder method
 * 5. Random selection within each stratum
 */
export function sampleTokens(
  tokens: TokenWithDemographics[],
  samplePercentage: number
): TokenWithDemographics[] {
  if (tokens.length === 0) return [];

  const targetSize = Math.max(1, Math.round((tokens.length * samplePercentage) / 100));

  if (targetSize >= tokens.length) return [...tokens];

  // Step 1: Detect dimensions with enough data (>10% coverage)
  const dimensionKeys: (keyof TokenWithDemographics)[] = [
    "sexe",
    "fonction",
    "lieu_travail",
    "type_contrat",
    "temps_travail",
    "cost_center",
    "direction_id",
    "department_id",
  ];

  const availableDimensions: StrataDimension[] = [];
  const minCoverage = tokens.length * 0.1;

  for (const key of dimensionKeys) {
    const nonNullCount = tokens.filter((t) => t[key] != null).length;
    if (nonNullCount >= minCoverage) {
      const values = new Set<string>();
      tokens.forEach((t) => {
        const val = t[key];
        if (val != null) values.add(String(val));
      });
      availableDimensions.push({ key, values });
    }
  }

  // Step 2: Limit to 3 dimensions, prioritize fewest distinct values
  const selectedDimensions = availableDimensions
    .sort((a, b) => a.values.size - b.values.size)
    .slice(0, 3);

  // If no dimensions available, do simple random sampling
  if (selectedDimensions.length === 0) {
    return simpleRandomSample(tokens, targetSize);
  }

  // Step 3: Group tokens into strata
  const strata = new Map<string, TokenWithDemographics[]>();

  for (const token of tokens) {
    const key = selectedDimensions
      .map((d) => String(token[d.key] ?? "_null_"))
      .join("|");
    if (!strata.has(key)) strata.set(key, []);
    strata.get(key)!.push(token);
  }

  // Step 4: Proportional allocation with largest remainder method
  const strataEntries = Array.from(strata.entries());
  const idealAllocations = strataEntries.map(([, tokens]) => ({
    tokens,
    ideal: (tokens.length / tokens.length) * targetSize * (tokens.length / tokens.length),
  }));

  // Recalculate ideal properly
  const allocations = strataEntries.map(([, stratumTokens]) => {
    const proportion = stratumTokens.length / tokens.length;
    const ideal = proportion * targetSize;
    const floor = Math.floor(ideal);
    const remainder = ideal - floor;
    return { tokens: stratumTokens, floor, remainder, allocated: floor };
  });

  // Distribute remainders using largest remainder method
  let totalAllocated = allocations.reduce((sum, a) => sum + a.allocated, 0);
  const remaining = targetSize - totalAllocated;

  // Sort by remainder descending to allocate extra slots
  const sortedByRemainder = allocations
    .map((a, i) => ({ ...a, index: i }))
    .sort((a, b) => b.remainder - a.remainder);

  for (let i = 0; i < remaining && i < sortedByRemainder.length; i++) {
    allocations[sortedByRemainder[i].index].allocated++;
  }

  // Step 5: Random selection within each stratum
  const selected: TokenWithDemographics[] = [];

  for (const alloc of allocations) {
    if (alloc.allocated <= 0) continue;
    // Ensure we don't try to take more than available
    const count = Math.min(alloc.allocated, alloc.tokens.length);
    const sampled = simpleRandomSample(alloc.tokens, count);
    selected.push(...sampled);
  }

  return selected;
}

/**
 * Fisher-Yates shuffle-based simple random sampling.
 */
function simpleRandomSample<T>(items: T[], count: number): T[] {
  const shuffled = [...items];
  // Fisher-Yates shuffle (partial)
  for (let i = shuffled.length - 1; i > 0 && i >= shuffled.length - count; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(shuffled.length - count);
}

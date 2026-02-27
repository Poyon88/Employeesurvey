"use client";

import { useCallback, useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown, ChevronUp, Filter, X } from "lucide-react";
import { SurveyFilters } from "@/lib/types";

type FilterOptions = {
  directions: { id: string; name: string }[];
  departments: { id: string; name: string; parent_id: string | null }[];
  services: { id: string; name: string; parent_id: string | null }[];
  sexe: string[];
  fonctions: string[];
  lieux_travail: string[];
  types_contrat: string[];
  temps_travail: string[];
  cost_centers: string[];
  hasDateNaissance: boolean;
  hasDateEntree: boolean;
  totalTokens: number;
};

type FilterPanelProps = {
  societeIds: string[];
  filters: SurveyFilters;
  onFiltersChange: (filters: SurveyFilters) => void;
};

export default function FilterPanel({
  societeIds,
  filters,
  onFiltersChange,
}: FilterPanelProps) {
  const [options, setOptions] = useState<FilterOptions | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const loadOptions = useCallback(async () => {
    if (societeIds.length === 0) {
      setOptions(null);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/surveys/filter-options?societe_ids=${societeIds.join(",")}`
      );
      if (res.ok) {
        const data = await res.json();
        setOptions(data);
      }
    } catch {
      // silent
    }
    setLoading(false);
  }, [societeIds]);

  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  const updateFilter = (key: keyof SurveyFilters, value: unknown) => {
    const newFilters = { ...filters, [key]: value };
    // Clean up empty arrays
    for (const k of Object.keys(newFilters) as (keyof SurveyFilters)[]) {
      const v = newFilters[k];
      if (Array.isArray(v) && v.length === 0) delete newFilters[k];
      if (v === undefined || v === null || (typeof v === "string" && v === "")) delete newFilters[k];
    }
    onFiltersChange(newFilters);
  };

  const toggleArrayValue = (key: keyof SurveyFilters, value: string) => {
    const current = (filters[key] as string[] | undefined) || [];
    const newValues = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    updateFilter(key, newValues);
  };

  const activeFilterCount = Object.keys(filters).filter((k) => {
    if (k === "societe_ids") return false; // societe is separate
    const v = filters[k as keyof SurveyFilters];
    if (Array.isArray(v)) return v.length > 0;
    return v !== undefined && v !== null && (typeof v !== "string" || v !== "");
  }).length;

  const clearFilters = () => {
    onFiltersChange({ societe_ids: filters.societe_ids });
  };

  if (!options || societeIds.length === 0) return null;

  const MultiCheckGroup = ({
    label,
    filterKey,
    values,
    nameMap,
  }: {
    label: string;
    filterKey: keyof SurveyFilters;
    values: string[];
    nameMap?: Record<string, string>;
  }) => {
    if (values.length === 0) return null;
    const selected = (filters[filterKey] as string[] | undefined) || [];
    return (
      <div className="space-y-2">
        <Label className="text-sm font-medium">
          {label}
          {selected.length > 0 && (
            <Badge variant="secondary" className="ml-2 text-xs">
              {selected.length}
            </Badge>
          )}
        </Label>
        <div className="flex flex-wrap gap-2">
          {values.map((v) => (
            <label
              key={v}
              className="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm cursor-pointer hover:bg-muted/50 transition-colors"
            >
              <Checkbox
                checked={selected.includes(v)}
                onCheckedChange={() => toggleArrayValue(filterKey, v)}
              />
              <span>{nameMap ? nameMap[v] || v : v}</span>
            </label>
          ))}
        </div>
      </div>
    );
  };

  // Build name maps for org units
  const directionNameMap: Record<string, string> = {};
  options.directions.forEach((d) => (directionNameMap[d.id] = d.name));
  const departmentNameMap: Record<string, string> = {};
  options.departments.forEach((d) => (departmentNameMap[d.id] = d.name));
  const serviceNameMap: Record<string, string> = {};
  options.services.forEach((d) => (serviceNameMap[d.id] = d.name));

  // Filter departments/services based on selected directions/departments
  const filteredDepartments =
    filters.direction_ids && filters.direction_ids.length > 0
      ? options.departments.filter((d) =>
          filters.direction_ids!.includes(d.parent_id || "")
        )
      : options.departments;

  const filteredServices =
    filters.department_ids && filters.department_ids.length > 0
      ? options.services.filter((s) =>
          filters.department_ids!.includes(s.parent_id || "")
        )
      : options.services;

  return (
    <Card>
      <CardHeader
        className="cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <CardTitle className="flex items-center justify-between text-base">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filtres de population
            {activeFilterCount > 0 && (
              <Badge variant="default" className="text-xs">
                {activeFilterCount} filtre(s) actif(s)
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  clearFilters();
                }}
              >
                <X className="mr-1 h-3 w-3" />
                Réinitialiser
              </Button>
            )}
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </div>
        </CardTitle>
      </CardHeader>
      {expanded && (
        <CardContent className="space-y-5">
          {loading ? (
            <p className="text-sm text-muted-foreground">
              Chargement des options...
            </p>
          ) : (
            <>
              {/* Org structure filters */}
              <MultiCheckGroup
                label="Direction"
                filterKey="direction_ids"
                values={options.directions.map((d) => d.id)}
                nameMap={directionNameMap}
              />
              <MultiCheckGroup
                label="Département"
                filterKey="department_ids"
                values={filteredDepartments.map((d) => d.id)}
                nameMap={departmentNameMap}
              />
              <MultiCheckGroup
                label="Service"
                filterKey="service_ids"
                values={filteredServices.map((d) => d.id)}
                nameMap={serviceNameMap}
              />

              {/* Demographic filters */}
              <MultiCheckGroup
                label="Sexe"
                filterKey="sexe"
                values={options.sexe}
              />
              <MultiCheckGroup
                label="Fonction"
                filterKey="fonctions"
                values={options.fonctions}
              />
              <MultiCheckGroup
                label="Lieu de travail"
                filterKey="lieux_travail"
                values={options.lieux_travail}
              />
              <MultiCheckGroup
                label="Type de contrat"
                filterKey="types_contrat"
                values={options.types_contrat}
              />
              <MultiCheckGroup
                label="Temps de travail"
                filterKey="temps_travail"
                values={options.temps_travail}
              />
              <MultiCheckGroup
                label="Cost center"
                filterKey="cost_centers"
                values={options.cost_centers}
              />

              {/* Age range */}
              {options.hasDateNaissance && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Tranche d&apos;âge</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      placeholder="Min"
                      className="w-24"
                      value={filters.age_min ?? ""}
                      onChange={(e) =>
                        updateFilter(
                          "age_min",
                          e.target.value ? Number(e.target.value) : undefined
                        )
                      }
                    />
                    <span className="text-sm text-muted-foreground">à</span>
                    <Input
                      type="number"
                      placeholder="Max"
                      className="w-24"
                      value={filters.age_max ?? ""}
                      onChange={(e) =>
                        updateFilter(
                          "age_max",
                          e.target.value ? Number(e.target.value) : undefined
                        )
                      }
                    />
                    <span className="text-sm text-muted-foreground">ans</span>
                  </div>
                </div>
              )}

              {/* Seniority range */}
              {options.hasDateEntree && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Ancienneté</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      placeholder="Min"
                      className="w-24"
                      value={filters.seniority_min ?? ""}
                      onChange={(e) =>
                        updateFilter(
                          "seniority_min",
                          e.target.value ? Number(e.target.value) : undefined
                        )
                      }
                    />
                    <span className="text-sm text-muted-foreground">à</span>
                    <Input
                      type="number"
                      placeholder="Max"
                      className="w-24"
                      value={filters.seniority_max ?? ""}
                      onChange={(e) =>
                        updateFilter(
                          "seniority_max",
                          e.target.value ? Number(e.target.value) : undefined
                        )
                      }
                    />
                    <span className="text-sm text-muted-foreground">an(s)</span>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}

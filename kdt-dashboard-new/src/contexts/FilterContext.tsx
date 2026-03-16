"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export type GlobalFilters = {
  selectedYear: number | null;
  yearType: "ended" | "started";
  periodOption: "3개월" | "6개월";
  filterZero: boolean;
};

type GlobalFilterContextValue = {
  filters: GlobalFilters;
  setSelectedYear: (year: number | null) => void;
  setYearType: (type: GlobalFilters["yearType"]) => void;
  setPeriodOption: (option: GlobalFilters["periodOption"]) => void;
  setFilterZero: (value: boolean) => void;
};

const STORAGE_KEY = "kdt-dashboard-global-filters";

const DEFAULT_FILTERS: GlobalFilters = {
  selectedYear: null,
  yearType: "ended",
  periodOption: "3개월",
  filterZero: false,
};

const GlobalFilterContext = createContext<GlobalFilterContextValue | null>(null);

function safeParseStoredFilters(raw: string | null): Partial<GlobalFilters> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as Partial<GlobalFilters>;
  } catch {
    return null;
  }
}

export function GlobalFilterProvider({ children }: { children: React.ReactNode }) {
  const [filters, setFilters] = useState<GlobalFilters>(() => {
    if (typeof window === "undefined") return DEFAULT_FILTERS;
    const stored = safeParseStoredFilters(window.localStorage.getItem(STORAGE_KEY));
    return { ...DEFAULT_FILTERS, ...(stored ?? {}) };
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
    } catch {
      // ignore
    }
  }, [filters]);

  const value = useMemo<GlobalFilterContextValue>(() => {
    return {
      filters,
      setSelectedYear: (year) => setFilters((prev) => ({ ...prev, selectedYear: year })),
      setYearType: (type) => setFilters((prev) => ({ ...prev, yearType: type })),
      setPeriodOption: (option) => setFilters((prev) => ({ ...prev, periodOption: option })),
      setFilterZero: (v) => setFilters((prev) => ({ ...prev, filterZero: v })),
    };
  }, [filters]);

  return <GlobalFilterContext.Provider value={value}>{children}</GlobalFilterContext.Provider>;
}

export function useGlobalFilters() {
  const ctx = useContext(GlobalFilterContext);
  if (!ctx) throw new Error("useGlobalFilters must be used within GlobalFilterProvider");
  return ctx;
}

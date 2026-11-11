"use client";
import { useMemo, useState } from "react";
import { MultiSelect } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { useQuery } from "@tanstack/react-query";
import type { Gql } from "@mgpl-diagnostics/client";
import { mgpl } from "@/lib/mgpl";

/**
 * Tests from the catalog (typo-tolerant, lab shorthand). Keeps the picked tests' catalog entries so their
 * prices stay known after the search changes. `exclude`: codes that can't be picked (already booked).
 */
export function TestPicker({ value, onChange, exclude = [], label = "Tests", error, autoFocus }: {
  value: string[];
  onChange: (codes: string[], tests: Map<string, Gql.CatalogTest>) => void;
  exclude?: string[];
  label?: string;
  error?: React.ReactNode;
  autoFocus?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [q] = useDebouncedValue(search.trim(), 200);
  const [picked, setPicked] = useState<Map<string, Gql.CatalogTest>>(new Map());
  const hits = useQuery({ queryKey: ["mgpl", "catalog", "search", q], queryFn: () => mgpl.catalog.search(q, { limit: 15 }), enabled: q.length >= 2, staleTime: 10 * 60_000 });

  const options = useMemo(() => {
    const m = new Map(picked);
    for (const h of hits.data ?? []) if (h.test.code && !exclude.includes(h.test.code)) m.set(h.test.code, h.test);
    return [...m.values()].filter((t) => t.code).map((t) => ({ value: t.code!, label: `${t.name}${t.mrp != null ? ` · Rs ${t.mrp}` : ""}` }));
  }, [hits.data, picked, exclude]);

  return (
    <MultiSelect
      label={label}
      placeholder="CBC, LFT, vit d, thyroid…"
      searchable
      data={options}
      searchValue={search}
      onSearchChange={setSearch}
      filter={({ options: o }) => o}
      nothingFoundMessage={q.length < 2 ? "Type two letters" : "No test matches"}
      hidePickedOptions
      error={error}
      data-autofocus={autoFocus || undefined}
      value={value}
      onChange={(codes) => {
        const all = new Map([...picked, ...(hits.data ?? []).filter((h) => h.test.code).map((h) => [h.test.code!, h.test] as const)]);
        const m = new Map<string, Gql.CatalogTest>();
        for (const c of codes) if (all.get(c)) m.set(c, all.get(c)!);
        setPicked(m);
        setSearch("");
        onChange(codes, m);
      }}
    />
  );
}

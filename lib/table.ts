"use client";
import { useMemo, useState } from "react";
import type { DataTableSortStatus } from "mantine-datatable";

const get = (o: unknown, path: string): unknown => path.split(".").reduce<unknown>((v, k) => (v == null ? v : (v as Record<string, unknown>)[k]), o);

/**
 * Client-side sorting, filtering and paging for mantine-datatable, for lists the api already caps at
 * 200 rows. Returns the props DataTable needs.
 */
export function useTable<T>(records: T[] | undefined, o: { sortBy: string; direction?: "asc" | "desc"; pageSize?: number; search?: string; searchKeys?: string[] }) {
  const [page, setPage] = useState(1);
  const [recordsPerPage, setPerPage] = useState(o.pageSize ?? 25);
  const [sortStatus, setSortStatus] = useState<DataTableSortStatus<T>>({ columnAccessor: o.sortBy, direction: o.direction ?? "desc" });
  const q = (o.search ?? "").trim().toLowerCase();
  const keys = o.searchKeys;

  const filtered = useMemo(() => {
    const all = records ?? [];
    const f = q && keys ? all.filter((r) => keys.some((k) => String(get(r, k) ?? "").toLowerCase().includes(q))) : all;
    const key = String(sortStatus.columnAccessor);
    const dir = sortStatus.direction === "asc" ? 1 : -1;
    return [...f].sort((a, b) => {
      const x = get(a, key);
      const y = get(b, key);
      if (x == null) return 1;
      if (y == null) return -1;
      return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "en-IN", { numeric: true })) * dir;
    });
  }, [records, q, keys, sortStatus]);

  const pages = Math.max(1, Math.ceil(filtered.length / recordsPerPage));
  const current = Math.min(page, pages);
  const slice = filtered.slice((current - 1) * recordsPerPage, current * recordsPerPage);

  return {
    records: slice,
    totalRecords: filtered.length,
    recordsPerPage,
    page: current,
    onPageChange: setPage,
    recordsPerPageOptions: [10, 25, 50, 100],
    onRecordsPerPageChange: (n: number) => {
      setPerPage(n);
      setPage(1);
    },
    sortStatus,
    onSortStatusChange: (s: DataTableSortStatus<T>) => {
      setSortStatus(s);
      setPage(1);
    },
    paginationText: ({ from, to, totalRecords }: { from: number; to: number; totalRecords: number }) => `${from} to ${to} of ${totalRecords}`,
    recordsPerPageLabel: "Rows",
  };
}

/** Shared DataTable look: hairlines, hover, no zebra, horizontal scroll on phones. */
export const tableLook = {
  withTableBorder: true,
  borderRadius: "lg",
  highlightOnHover: true,
  verticalSpacing: "sm",
  horizontalSpacing: "md",
  minHeight: 180,
  noRecordsText: "Nothing here yet",
} as const;

"use client";
// Data hooks: TanStack Query over the typed client. Keys start with "mgpl" so a sign-out clears them all
// (clearOnSignOut) and a mutation can refresh a whole area with invalidateQueries({ queryKey: ["mgpl", area] }).
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import type { Gql } from "@mgpl-diagnostics/client";
import { errorMessage, mgpl } from "./mgpl";
import { useViewer } from "./viewer";

const branchArg = (id: string | null) => (id ? { branchId: id } : {});

export function useBookings(filter: { status?: Gql.BookingStatus; patientId?: string; limit?: number } = {}, enabled = true) {
  const { branchId, can } = useViewer();
  const vars = { ...branchArg(branchId), ...filter, limit: filter.limit ?? 200 };
  return useQuery({ queryKey: ["mgpl", "bookings", vars], queryFn: () => mgpl.bookings.list(vars), enabled: enabled && can("booking:read") });
}

export function useBooking(id: string | null) {
  return useQuery({ queryKey: ["mgpl", "bookings", "one", id], queryFn: () => mgpl.bookings.get(id!), enabled: !!id });
}

export function useInvoices(filter: { status?: Gql.InvoiceStatus; patientId?: string; limit?: number } = {}, enabled = true) {
  const { branchId, can } = useViewer();
  const vars = { ...branchArg(branchId), ...filter, limit: filter.limit ?? 200 };
  return useQuery({ queryKey: ["mgpl", "invoices", vars], queryFn: () => mgpl.invoices.list(vars), enabled: enabled && can("invoice:read") });
}

export function useDoctors(activeOnly = true) {
  const { can } = useViewer();
  return useQuery({ queryKey: ["mgpl", "doctors", activeOnly], queryFn: () => mgpl.doctors.list(activeOnly), enabled: can("doctor:read"), staleTime: 5 * 60_000 });
}

/** Partner-lab imports, newest first, 50 a page (the api pages them with a cursor). */
export function useImports(filter: { status?: Gql.ExternalReportStatus; bookingId?: string } = {}) {
  const { branchId, can } = useViewer();
  const vars = { ...branchArg(branchId), ...filter };
  return useInfiniteQuery({
    queryKey: ["mgpl", "imports", vars],
    queryFn: ({ pageParam }) => mgpl.imports.list({ ...vars, first: 50, ...(pageParam ? { after: pageParam } : {}) }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => (last.pageInfo.hasNextPage ? last.pageInfo.endCursor : null),
    enabled: can("report:import"),
  });
}

export function useImport(id: string | null) {
  return useQuery({ queryKey: ["mgpl", "imports", "one", id], queryFn: () => mgpl.imports.get(id!), enabled: !!id });
}

/** The partner signatory registry (signatory:read). */
export function useSignatories(lab?: Gql.ExternalLab) {
  const { can } = useViewer();
  return useQuery({ queryKey: ["mgpl", "signatories", lab ?? "all"], queryFn: () => mgpl.imports.signatories(lab), enabled: can("signatory:read") });
}

/** A mutation that shows a toast, and refreshes the given areas when it works. */
export function useAction<V, R>(fn: (v: V) => Promise<R>, o: { success?: string | ((r: R) => string); refresh?: string[][]; onDone?: (r: R) => void } = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: async (r) => {
      await Promise.all((o.refresh ?? []).map((k) => qc.invalidateQueries({ queryKey: k })));
      if (o.success) notifications.show({ color: "tulsi", message: typeof o.success === "function" ? o.success(r) : o.success });
      o.onDone?.(r);
    },
    onError: (err) => notifications.show({ color: "red", title: "That didn't work", message: errorMessage(err) }),
  });
}

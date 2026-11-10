"use client";
// Update notices for owners and admins (api: systemUpdates, permission settings:manage). Written with
// mgpl.request so the app works on client 1.5 and on an api without the field (then: no notice).
import { useQuery } from "@tanstack/react-query";
import { MgplGraphQLError } from "@mgpl-diagnostics/client";
import { mgpl } from "./mgpl";
import { useViewer } from "./viewer";

/** This build's version (package.json, set in next.config.ts). The release workflow checks it equals the tag. */
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || "0.0.0";

export interface Release { version: string; name: string | null; notes: string | null; url: string | null; publishedAt: string | null }
export interface ComponentUpdate { component: "api" | "dashboard"; current: string | null; latest: string | null; updateAvailable: boolean; image: string; changes: Release[] }
export interface SystemUpdates { enabled: boolean; checkedAt: string | null; error: string | null; updateAvailable: boolean; docsUrl: string; steps: string[]; components: ComponentUpdate[] }

const QUERY = `query SystemUpdates($dashboardVersion: String, $refresh: Boolean) {
  systemUpdates(dashboardVersion: $dashboardVersion, refresh: $refresh) {
    enabled checkedAt error updateAvailable docsUrl steps
    components { component current latest updateAvailable image changes { version name notes url publishedAt } }
  }
}`;

/** null when the api has no update check yet (older api). */
export async function fetchUpdates(refresh = false): Promise<SystemUpdates | null> {
  try {
    return (await mgpl.request<{ systemUpdates: SystemUpdates }>(QUERY, { dashboardVersion: APP_VERSION, refresh })).systemUpdates;
  } catch (err) {
    if (err instanceof MgplGraphQLError && err.code === "GRAPHQL_VALIDATION_FAILED") return null;
    throw err;
  }
}

export const COMPONENT_NAMES: Record<ComponentUpdate["component"], string> = { api: "Server (api)", dashboard: "Dashboard" };

/** The update check, for people with settings:manage only. The server caches GitHub for hours; so do we. */
export function useSystemUpdates() {
  const { can } = useViewer();
  return useQuery({ queryKey: ["mgpl", "systemUpdates"], queryFn: () => fetchUpdates(), enabled: can("settings:manage"), staleTime: 30 * 60_000, retry: false });
}

/** "api 0.1.0 → 0.2.0" pairs for the notice; a key that changes when a newer release comes out. */
export function pendingUpdates(u: SystemUpdates | null | undefined) {
  const list = (u?.components ?? []).filter((c) => c.updateAvailable);
  return { list, key: list.map((c) => `${c.component}@${c.latest}`).join(",") };
}

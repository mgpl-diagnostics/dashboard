"use client";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useLocalStorage } from "@mantine/hooks";
import type { Gql } from "@mgpl-diagnostics/client";
import { permits } from "./access";

export interface ViewerContextValue {
  viewer: Gql.Viewer;
  /** Does the signed-in user hold `permission` anywhere (the api re-checks it per branch)? */
  can: (permission: string) => boolean;
  /** Branches this user works in: all of them for an organisation-wide role. */
  branches: Gql.Branch[];
  /** The branch picked in the header, or null for "all branches". */
  branchId: string | null;
  setBranchId: (id: string | null) => void;
  /** The branch new records go to: the picked one, else the user's first branch. */
  workBranchId: string | null;
}

const Ctx = createContext<ViewerContextValue | null>(null);

export function ViewerProvider({ viewer, children }: { viewer: Gql.Viewer; children: ReactNode }) {
  const [stored, setStored] = useLocalStorage<string | null>({ key: "mgpl.dashboard.branch", defaultValue: null });
  const value = useMemo<ViewerContextValue>(() => {
    const orgWide = viewer.user.roles.some((r) => r.branchId === null);
    const own = new Set(viewer.user.roles.map((r) => r.branchId).filter(Boolean));
    const branches = viewer.organization.branches.filter((b) => b.active && (orgWide || own.has(b.id)));
    const branchId = stored && branches.some((b) => b.id === stored) ? stored : !orgWide && branches.length === 1 ? branches[0].id : null;
    return {
      viewer,
      can: (p) => permits(viewer.permissions, p),
      branches,
      branchId,
      setBranchId: setStored,
      workBranchId: branchId ?? branches[0]?.id ?? null,
    };
  }, [viewer, stored, setStored]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useViewer(): ViewerContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useViewer outside ViewerProvider");
  return v;
}

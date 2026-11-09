"use client";
import type { ReactNode } from "react";
import { Alert } from "@mantine/core";
import { LockSimpleIcon } from "@phosphor-icons/react";
import { useViewer } from "@/lib/viewer";

/** Shows children only to users who hold `permission`; others get a plain explanation. */
export function Guard({ permission, children }: { permission: string; children: ReactNode }) {
  const { can } = useViewer();
  if (can(permission)) return <>{children}</>;
  return (
    <Alert color="gray" icon={<LockSimpleIcon size={18} />} title="Not part of your role">
      This page needs the {permission} permission. Ask an admin if your work needs it.
    </Alert>
  );
}

// Who sees what. Permission names and the system roles are auth-kit's (src/rbac.ts); the api checks every
// call again, per branch, so hiding a link here is about a calm screen, never about security.
import type { Icon } from "@phosphor-icons/react";
import {
  SunHorizonIcon, UsersThreeIcon, CalendarCheckIcon, TestTubeIcon, FileTextIcon, ReceiptIcon,
  BookOpenTextIcon, StethoscopeIcon, UserGearIcon, BuildingsIcon, ClockCounterClockwiseIcon, UserCircleIcon, ArrowCircleUpIcon,
  FileArrowUpIcon, HandshakeIcon,
} from "@phosphor-icons/react";

export interface NavItem { href: string; label: string; icon: Icon; permission?: string; group: "Work" | "Money" | "Organisation" | "You" }

export const NAV: NavItem[] = [
  { href: "/", label: "Today", icon: SunHorizonIcon, group: "Work" },
  { href: "/patients", label: "Patients", icon: UsersThreeIcon, permission: "patient:read", group: "Work" },
  { href: "/bookings", label: "Bookings", icon: CalendarCheckIcon, permission: "booking:read", group: "Work" },
  { href: "/samples", label: "Samples", icon: TestTubeIcon, permission: "sample:read", group: "Work" },
  { href: "/reports", label: "Reports", icon: FileTextIcon, permission: "report:read", group: "Work" },
  { href: "/imports", label: "Partner imports", icon: FileArrowUpIcon, permission: "report:import", group: "Work" },
  { href: "/invoices", label: "Invoices", icon: ReceiptIcon, permission: "invoice:read", group: "Money" },
  { href: "/accounts", label: "Accounts", icon: BookOpenTextIcon, permission: "accounts:read", group: "Money" },
  { href: "/settlements", label: "Settlements", icon: HandshakeIcon, permission: "accounts:read", group: "Money" },
  { href: "/doctors", label: "Doctors", icon: StethoscopeIcon, permission: "doctor:read", group: "Organisation" },
  { href: "/users", label: "Users and roles", icon: UserGearIcon, permission: "user:read", group: "Organisation" },
  { href: "/branches", label: "Branches", icon: BuildingsIcon, permission: "branch:read", group: "Organisation" },
  { href: "/audit", label: "Audit log", icon: ClockCounterClockwiseIcon, permission: "audit:read", group: "Organisation" },
  { href: "/updates", label: "Updates", icon: ArrowCircleUpIcon, permission: "settings:manage", group: "Organisation" },
  { href: "/account", label: "My account", icon: UserCircleIcon, group: "You" },
];

export const NAV_GROUPS = ["Work", "Money", "Organisation", "You"] as const;

/** auth-kit's SYSTEM_ROLES keys and names, for labels. Organisations can add their own roles. */
export const ROLE_NAMES: Record<string, string> = {
  owner: "Owner",
  admin: "Administrator",
  branch_manager: "Branch manager",
  front_desk: "Front desk",
  phlebotomist: "Phlebotomist",
  technician: "Lab technician",
  pathologist: "Pathologist",
  accountant: "Accountant",
  doctor: "Referring doctor",
};

export const roleName = (key: string) => ROLE_NAMES[key] ?? key.replace(/_/g, " ");

/** auth-kit's permissionMatches: "*" works in either part. */
export function permits(granted: readonly string[], wanted: string): boolean {
  const [wr, wa] = wanted.split(":");
  return granted.some((g) => {
    if (g === wanted || g === "*:*" || g === "*") return true;
    const [gr, ga] = g.split(":");
    return (gr === "*" || gr === wr) && (ga === "*" || ga === wa);
  });
}

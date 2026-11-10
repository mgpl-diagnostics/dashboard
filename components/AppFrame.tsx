"use client";
import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ActionIcon, AppShell, Box, Avatar, Burger, Center, Group, Kbd, Loader, Menu, NavLink, ScrollArea, Select,
  Stack, Text, Tooltip, UnstyledButton, useComputedColorScheme, useMantineColorScheme, VisuallyHidden,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { Spotlight, spotlight, type SpotlightActionData } from "@mantine/spotlight";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { MagnifyingGlassIcon, MoonIcon, SignOutIcon, SunIcon, UserCircleIcon, CaretUpDownIcon, CheckIcon, BuildingsIcon } from "@phosphor-icons/react";
import { errorMessage, mgpl } from "@/lib/mgpl";
import { labs as labApi } from "@/lib/labs";
import { useSession } from "@/lib/session";
import { NAV, NAV_GROUPS, permits, roleName } from "@/lib/access";
import { ViewerProvider, useViewer } from "@/lib/viewer";
import { Brand } from "./Brand";
import { SmoothScroll } from "./SmoothScroll";
import { QueryError } from "./QueryError";

/** Signed-in area: checks the session, loads the viewer once, then draws the shell. */
export function AppFrame({ children }: { children: ReactNode }) {
  const snapshot = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const signedIn = snapshot?.status === "signed_in";

  useEffect(() => {
    if (snapshot && !signedIn) router.replace(pathname === "/" ? "/login" : `/login?next=${encodeURIComponent(pathname)}`);
  }, [snapshot, signedIn, router, pathname]);

  const viewer = useQuery({ queryKey: ["mgpl", "viewer"], queryFn: () => mgpl.auth.viewer(), enabled: signedIn, staleTime: 60_000 });

  if (!signedIn || viewer.isPending) return <Center mih="100dvh"><Loader size="sm" aria-label="Loading" /></Center>;
  if (viewer.isError) return <Center mih="100dvh" p="md"><QueryError error={viewer.error} retry={() => viewer.refetch()} /></Center>;
  if (!viewer.data) return <Center mih="100dvh"><Loader size="sm" aria-label="Signing out" /></Center>;

  return (
    <ViewerProvider viewer={viewer.data}>
      <Shell>{children}</Shell>
    </ViewerProvider>
  );
}

/** The labs this person can work in (same email); one entry when they work at one lab. */
function useLabs() {
  const qc = useQueryClient();
  const router = useRouter();
  const labs = useQuery({ queryKey: ["mgpl", "myOrganizations"], queryFn: labApi.mine, staleTime: 5 * 60_000, retry: false });
  async function switchTo(code: string, name: string) {
    try {
      await labApi.switchTo(code);
      // everything cached belongs to the old lab
      await qc.resetQueries();
      router.replace("/");
      notifications.show({ color: "tulsi", title: `Now in ${name}`, message: "Bookings, reports and money now show this lab" });
    } catch (err) {
      notifications.show({ color: "red", title: "Couldn't switch lab", message: errorMessage(err) });
      await qc.invalidateQueries({ queryKey: ["mgpl", "myOrganizations"] });
    }
  }
  return { labs: labs.data ?? [], switchTo };
}

function Shell({ children }: { children: ReactNode }) {
  const [opened, { toggle, close }] = useDisclosure(false);
  const pathname = usePathname();
  const router = useRouter();
  const { viewer, can, branches, branchId, setBranchId } = useViewer();
  const orgWide = viewer.user.roles.some((r) => r.branchId === null);
  const items = NAV.filter((n) => !n.permission || can(n.permission));
  const active = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));

  useEffect(close, [pathname, close]);

  const actions: SpotlightActionData[] = items.map((n) => ({
    id: n.href, label: n.label, description: n.group, leftSection: <n.icon size={18} />, onClick: () => router.push(n.href),
  }));
  const { labs, switchTo } = useLabs();
  for (const l of labs) if (!l.current) actions.push({ id: `lab-${l.code}`, label: `Switch to ${l.name}`, description: "Lab", leftSection: <BuildingsIcon size={18} />, onClick: () => switchTo(l.code, l.name) });
  if (permits(viewer.permissions, "booking:create")) actions.unshift({ id: "new-booking", label: "New booking", description: "Work", onClick: () => router.push("/bookings?new=1") });
  if (permits(viewer.permissions, "patient:create")) actions.unshift({ id: "new-patient", label: "Register a patient", description: "Work", onClick: () => router.push("/patients?new=1") });

  return (
    <AppShell header={{ height: 56 }} navbar={{ width: 256, breakpoint: "sm", collapsed: { mobile: !opened } }} padding={0}>
      <AppShell.Header px="md">
        <Group h="100%" justify="space-between" wrap="nowrap" gap="sm">
          <Group gap="sm" wrap="nowrap">
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" aria-label={opened ? "Close menu" : "Open menu"} />
            <Link href="/" style={{ color: "inherit", textDecoration: "none" }} aria-label="Today">
              <Brand compact />
            </Link>
          </Group>
          <Group gap="xs" wrap="nowrap">
            {branches.length > 1 && (
              <Select
                aria-label="Branch"
                size="xs"
                w={{ base: 120, sm: 200 }}
                data={[...(orgWide ? [{ value: "", label: "All branches" }] : []), ...branches.map((b) => ({ value: b.id, label: b.name }))]}
                value={branchId ?? ""}
                onChange={(v) => setBranchId(v || null)}
                comboboxProps={{ withinPortal: true }}
              />
            )}
            <UnstyledButton onClick={spotlight.open} visibleFrom="sm" aria-label="Search pages and actions">
              <Group gap={8} px="sm" h={30} style={{ border: "1px solid var(--mantine-color-default-border)", borderRadius: 8 }}>
                <MagnifyingGlassIcon size={16} color="var(--mantine-color-dimmed)" />
                <Text size="sm" c="dimmed">Search</Text>
                <Kbd size="xs">Ctrl K</Kbd>
              </Group>
            </UnstyledButton>
            <ActionIcon variant="subtle" color="gray" onClick={spotlight.open} hiddenFrom="sm" aria-label="Search pages and actions">
              <MagnifyingGlassIcon size={18} />
            </ActionIcon>
            <Box visibleFrom="xs"><ColorSchemeToggle /></Box>
            <UserMenu labs={labs} switchTo={switchTo} />
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar>
        <AppShell.Section grow component={ScrollArea} px="sm" py="md">
          <Stack gap={20}>
            {NAV_GROUPS.map((g) => {
              const group = items.filter((n) => n.group === g);
              if (!group.length) return null;
              return (
                <Stack key={g} gap={2}>
                  <Text size="xs" c="dimmed" px="sm" pb={6}>{g}</Text>
                  {group.map((n) => (
                    <NavLink
                      key={n.href}
                      component={Link}
                      href={n.href}
                      label={n.label}
                      leftSection={<n.icon size={18} />}
                      active={active(n.href)}
                      variant="light"
                      h={36}
                      style={{ borderRadius: 8 }}
                    />
                  ))}
                </Stack>
              );
            })}
          </Stack>
        </AppShell.Section>
        <AppShell.Section px="md" py="sm" style={{ borderTop: "1px solid var(--mantine-color-default-border)" }}>
          <Text size="xs" c="dimmed" lineClamp={1}>{viewer.organization.name}</Text>
          <Text size="xs" c="dimmed" lineClamp={2}>
            {[...new Set(viewer.user.roles.map((r) => roleName(r.role)))].join(", ") || "No role yet"}
          </Text>
        </AppShell.Section>
      </AppShell.Navbar>

      <SmoothScroll>{children}</SmoothScroll>

      <Spotlight
        actions={actions}
        shortcut={["mod + K", "/"]}
        nothingFound="Nothing matches"
        highlightQuery
        searchProps={{ leftSection: <MagnifyingGlassIcon size={18} />, placeholder: "Search" }}
      />
    </AppShell>
  );
}

function ColorSchemeToggle() {
  const { setColorScheme } = useMantineColorScheme();
  const computed = useComputedColorScheme("light", { getInitialValueInEffect: true });
  const next = computed === "dark" ? "light" : "dark";
  return (
    <Tooltip label={`Switch to ${next} mode`}>
      <ActionIcon variant="subtle" color="gray" onClick={() => setColorScheme(next)} aria-label={`Switch to ${next} mode`}>
        {computed === "dark" ? <SunIcon size={18} /> : <MoonIcon size={18} />}
      </ActionIcon>
    </Tooltip>
  );
}

function UserMenu({ labs, switchTo }: ReturnType<typeof useLabs>) {
  const { viewer } = useViewer();
  const router = useRouter();
  const initials = viewer.user.name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return (
    <Menu position="bottom-end" width={240} shadow="md">
      <Menu.Target>
        <UnstyledButton aria-label="Account menu">
          <Group gap={6} wrap="nowrap">
            <Avatar size={28} radius="xl" color="navy" variant="light">{initials}</Avatar>
            <CaretUpDownIcon size={14} color="var(--mantine-color-dimmed)" />
            <VisuallyHidden>{viewer.user.name}</VisuallyHidden>
          </Group>
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>
          <Text size="sm" c="var(--mantine-color-text)" fw={500} lineClamp={1}>{viewer.user.name}</Text>
          <Text size="xs" c="dimmed" lineClamp={1}>{viewer.user.email}</Text>
        </Menu.Label>
        {labs.length > 1 && (
          <>
            <Menu.Divider />
            <Menu.Label>Lab</Menu.Label>
            {labs.map((l) => (
              <Menu.Item
                key={l.code}
                leftSection={l.current ? <CheckIcon size={16} /> : <BuildingsIcon size={16} />}
                disabled={l.current}
                onClick={() => switchTo(l.code, l.name)}
              >
                {l.name}
              </Menu.Item>
            ))}
            <Menu.Divider />
          </>
        )}
        <Menu.Item leftSection={<UserCircleIcon size={16} />} component={Link} href="/account">My account</Menu.Item>
        <Menu.Divider />
        <Menu.Item
          leftSection={<SignOutIcon size={16} />}
          onClick={async () => {
            await mgpl.auth.logout();
            router.replace("/login");
          }}
        >
          Sign out
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}

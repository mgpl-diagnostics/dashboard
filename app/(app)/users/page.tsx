"use client";
import { useState } from "react";
import { ActionIcon, Badge, Button, Checkbox, Group, Modal, PasswordInput, ScrollArea, Select, SimpleGrid, Stack, Tabs, Text, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { modals } from "@mantine/modals";
import { DataTable } from "mantine-datatable";
import { useQuery } from "@tanstack/react-query";
import { PlusIcon, TrashIcon } from "@phosphor-icons/react";
import type { Gql } from "@mgpl-diagnostics/client";
import { Enter } from "@/components/Enter";
import { Guard } from "@/components/Guard";
import { PageHeader } from "@/components/PageHeader";
import { QueryError } from "@/components/QueryError";
import { StatusBadge } from "@/components/StatusBadge";
import { roleName } from "@/lib/access";
import { ago } from "@/lib/format";
import { mgpl } from "@/lib/mgpl";
import { useAction } from "@/lib/queries";
import { tableLook, useTable } from "@/lib/table";
import { useViewer } from "@/lib/viewer";

export default function UsersPage() {
  return (
    <Guard permission="user:read">
      <Tabs defaultValue="users" keepMounted={false}>
        <Enter>
          <UsersHeader />
          <Tabs.Panel value="users"><Users /></Tabs.Panel>
          <Tabs.Panel value="roles"><Roles /></Tabs.Panel>
        </Enter>
      </Tabs>
    </Guard>
  );
}

function UsersHeader() {
  const { can } = useViewer();
  return (
    <>
      <PageHeader title="Users and roles" description="Roles can be held for one branch or the whole organisation" />
      <Tabs.List data-enter>
        <Tabs.Tab value="users">Users</Tabs.Tab>
        {can("role:read") && <Tabs.Tab value="roles">Roles</Tabs.Tab>}
      </Tabs.List>
    </>
  );
}

function Users() {
  const { can, viewer } = useViewer();
  const q = useQuery({ queryKey: ["mgpl", "users"], queryFn: () => mgpl.users.list() });
  const [editing, setEditing] = useState<Gql.User | "new" | null>(null);
  const table = useTable(q.data, { sortBy: "name", direction: "asc" });
  const branchName = (id: string | null) => (id ? (viewer.organization.branches.find((b) => b.id === id)?.name ?? "A branch") : "All branches");
  return (
    <Stack gap="md" mt="md">
      {can("user:create") && <Group justify="flex-end"><Button leftSection={<PlusIcon size={16} />} onClick={() => setEditing("new")}>Add user</Button></Group>}
      {q.isError ? <QueryError error={q.error} retry={() => q.refetch()} /> : (
        <DataTable<Gql.User>
          {...tableLook}
          {...table}
          fetching={q.isPending}
          onRowClick={can("user:update") ? ({ record }) => setEditing(record) : undefined}
          columns={[
            { accessor: "name", title: "Name", sortable: true, render: (u) => <><Text size="sm" fw={500}>{u.name}</Text><Text size="xs" c="dimmed">{u.email}</Text></> },
            {
              accessor: "roles", title: "Roles",
              render: (u) => (
                <Group gap={4}>
                  {u.roles.map((r, k) => <Badge key={k} color="gray" variant="light">{roleName(r.role)}{r.branchId ? ` · ${branchName(r.branchId)}` : ""}</Badge>)}
                </Group>
              ),
            },
            { accessor: "lastLoginAt", title: "Last sign-in", sortable: true, visibleMediaQuery: (t) => `(min-width: ${t.breakpoints.md})`, render: (u) => (u.lastLoginAt ? ago(u.lastLoginAt) : "Never") },
            { accessor: "status", title: "", textAlign: "right", render: (u) => <StatusBadge status={u.status} /> },
          ]}
        />
      )}
      {editing && <UserForm user={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </Stack>
  );
}

function UserForm({ user, onClose }: { user: Gql.User | null; onClose: () => void }) {
  const { viewer, can } = useViewer();
  const roles = useQuery({ queryKey: ["mgpl", "roles"], queryFn: () => mgpl.users.roles(), enabled: can("role:read"), staleTime: 5 * 60_000 });
  const roleOptions = (roles.data?.map((r) => ({ value: r.key, label: r.name })) ?? Object.entries({ owner: 1, admin: 1, branch_manager: 1, front_desk: 1, phlebotomist: 1, technician: 1, pathologist: 1, accountant: 1, doctor: 1 }).map(([k]) => ({ value: k, label: roleName(k) })));
  const branchOptions = [{ value: "", label: "All branches" }, ...viewer.organization.branches.map((b) => ({ value: b.id, label: b.name }))];
  const form = useForm({
    initialValues: { name: user?.name ?? "", email: user?.email ?? "", phone: user?.phone ?? "", password: "", roles: (user?.roles ?? [{ role: "front_desk", branchId: null }]).map((r) => ({ role: r.role, branchId: r.branchId ?? "" })) },
    validate: {
      name: (v) => (v.trim().length < 2 ? "Enter the full name" : null),
      email: (v) => (/^\S+@\S+\.\S+$/.test(v) ? null : "Check the email"),
      password: (v) => (!user && v.length < 10 ? "Use at least 10 characters" : null),
      roles: (v) => (v.length ? null : "Give at least one role"),
    },
  });
  const refresh = [["mgpl", "users"]];
  const save = useAction(
    async (v: typeof form.values) => {
      const roles = v.roles.map((r) => ({ role: r.role, branchId: r.branchId || null }));
      if (user) return mgpl.users.setRoles(user.id, roles);
      return mgpl.users.create({ name: v.name.trim(), email: v.email.trim(), phone: v.phone || undefined, password: v.password, roles });
    },
    { success: user ? "Roles saved. They apply on the user's next request" : "User added", refresh, onDone: onClose },
  );
  const toggle = useAction((u: Gql.User) => (u.status === "disabled" ? mgpl.users.enable(u.id) : mgpl.users.disable(u.id)), { success: (u) => (u.status === "disabled" ? "Switched off. Their sessions end now" : "Switched back on"), refresh, onDone: onClose });
  const self = user?.id === viewer.user.id;
  const [resetting, setResetting] = useState(false);

  return (
    <Modal opened onClose={onClose} title={user ? user.name : "Add a user"} size="lg">
      <form onSubmit={form.onSubmit((v) => save.mutate(v))}>
        <Stack>
          {!user && (
            <>
              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                <TextInput label="Full name" data-autofocus {...form.getInputProps("name")} />
                <TextInput label="Email" type="email" {...form.getInputProps("email")} />
                <TextInput label="Mobile" inputMode="numeric" {...form.getInputProps("phone")} />
                <PasswordInput label="First password" description="They can change it in My account" {...form.getInputProps("password")} />
              </SimpleGrid>
            </>
          )}
          <Stack gap="xs">
            <Text size="sm" fw={500}>Roles</Text>
            {form.values.roles.map((_, k) => (
              <Group key={k} gap="xs" wrap="nowrap" align="flex-start">
                <Select aria-label="Role" data={roleOptions} searchable flex={1} {...form.getInputProps(`roles.${k}.role`)} />
                <Select aria-label="Where" data={branchOptions} flex={1} {...form.getInputProps(`roles.${k}.branchId`)} />
                <ActionIcon variant="subtle" color="gray" size="lg" aria-label="Remove role" onClick={() => form.removeListItem("roles", k)}><TrashIcon size={16} /></ActionIcon>
              </Group>
            ))}
            {form.errors.roles && <Text size="xs" c="red">{form.errors.roles}</Text>}
            <Button variant="subtle" size="compact-sm" w="fit-content" leftSection={<PlusIcon size={14} />} onClick={() => form.insertListItem("roles", { role: "front_desk", branchId: "" })}>Add a role</Button>
          </Stack>
          <Group justify="space-between">
            {user && can("user:disable") && !self ? (
              <Button
                variant="subtle"
                color={user.status === "disabled" ? "tulsi" : "red"}
                onClick={() =>
                  modals.openConfirmModal({
                    title: user.status === "disabled" ? `Switch ${user.name} back on?` : `Switch ${user.name} off?`,
                    children: <Text size="sm">{user.status === "disabled" ? "They can sign in again." : "They're signed out everywhere and can't sign in until switched back on."}</Text>,
                    labels: { confirm: user.status === "disabled" ? "Switch on" : "Switch off", cancel: "Cancel" },
                    confirmProps: { color: user.status === "disabled" ? "tulsi" : "red" },
                    onConfirm: () => toggle.mutate(user),
                  })
                }
              >
                {user.status === "disabled" ? "Switch on" : "Switch off"}
              </Button>
            ) : <span />}
            <Group gap="xs">
              {user && can("user:update") && !self && <Button variant="subtle" onClick={() => setResetting(true)}>Set password</Button>}
              <Button variant="default" onClick={onClose}>Cancel</Button>
              <Button type="submit" loading={save.isPending} disabled={!!user && !can("role:manage") && !can("user:update")}>{user ? "Save roles" : "Add user"}</Button>
            </Group>
          </Group>
        </Stack>
      </form>
      {user && resetting && <SetPassword user={user} onClose={() => setResetting(false)} />}
    </Modal>
  );
}

/** Sets another user's password (user:update). Their sessions end, so they sign in again with it. */
function SetPassword({ user, onClose }: { user: Gql.User; onClose: () => void }) {
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const run = useAction(() => mgpl.users.setPassword(user.id, password), { success: `Password set. ${user.name} is signed out everywhere and signs in with the new one`, onDone: onClose });
  const short = password.length > 0 && password.length < 10;
  const differs = again.length > 0 && again !== password;
  return (
    <Modal opened onClose={onClose} title={`Set a password for ${user.name}`} size="sm">
      <Stack gap="sm">
        <Text size="sm" c="dimmed">For someone who can&apos;t reset it by email. Tell them the password in person; they can change it in My account.</Text>
        <PasswordInput label="New password" description="At least 10 characters, not their name or email" data-autofocus autoComplete="new-password" value={password} onChange={(e) => setPassword(e.currentTarget.value)} error={short ? "Use at least 10 characters" : null} />
        <PasswordInput label="Type it again" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.currentTarget.value)} error={differs ? "The two don't match" : null} />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>Cancel</Button>
          <Button color="red" loading={run.isPending} disabled={password.length < 10 || password !== again} onClick={() => run.mutate(undefined)}>Set password</Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function Roles() {
  const { can } = useViewer();
  const roles = useQuery({ queryKey: ["mgpl", "roles"], queryFn: () => mgpl.users.roles() });
  const perms = useQuery({ queryKey: ["mgpl", "permissions"], queryFn: () => mgpl.users.permissions(), staleTime: Infinity });
  const [editing, setEditing] = useState<Gql.Role | "new" | null>(null);
  return (
    <Stack gap="md" mt="md">
      {can("role:manage") && <Group justify="flex-end"><Button leftSection={<PlusIcon size={16} />} onClick={() => setEditing("new")}>New role</Button></Group>}
      {roles.isError ? <QueryError error={roles.error} /> : (
        <DataTable<Gql.Role>
          {...tableLook}
          fetching={roles.isPending}
          records={roles.data ?? []}
          onRowClick={can("role:manage") ? ({ record }) => setEditing(record) : undefined}
          columns={[
            { accessor: "name", title: "Role", render: (r) => <><Text size="sm" fw={500}>{r.name}</Text><Text size="xs" c="dimmed" ff="monospace" style={{ whiteSpace: "nowrap" }}>{r.key}</Text></> },
            { accessor: "permissions", title: "Permissions", render: (r) => <Text size="sm" c="dimmed" lineClamp={2}>{r.permissions.join(", ")}</Text> },
            { accessor: "system", title: "", textAlign: "right", render: (r) => (r.system ? <Badge color="gray">Built in</Badge> : null) },
          ]}
        />
      )}
      {editing && <RoleForm role={editing === "new" ? null : editing} all={perms.data ?? []} onClose={() => setEditing(null)} />}
    </Stack>
  );
}

function RoleForm({ role, all, onClose }: { role: Gql.Role | null; all: string[]; onClose: () => void }) {
  const form = useForm({
    initialValues: { key: role?.key ?? "", name: role?.name ?? "", permissions: role?.permissions ?? [] },
    validate: { key: (v) => (/^[a-z][a-z0-9_]{1,31}$/.test(v) ? null : "Lowercase letters, digits and _"), name: (v) => (v.trim() ? null : "Name the role") },
  });
  const save = useAction((v: Gql.RoleInput) => mgpl.users.upsertRole(v), { success: "Role saved", refresh: [["mgpl", "roles"]], onDone: onClose });
  const byResource = all.reduce<Record<string, string[]>>((m, p) => ((m[p.split(":")[0]] ??= []).push(p), m), {});
  return (
    <Modal opened onClose={onClose} title={role ? `Edit ${role.name}` : "New role"} size="xl">
      <form onSubmit={form.onSubmit((v) => save.mutate(v))}>
        <Stack>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput label="Key" disabled={!!role} {...form.getInputProps("key")} />
            <TextInput label="Name" {...form.getInputProps("name")} />
          </SimpleGrid>
          {role?.system && <Text size="sm" c="dimmed">This is a built-in role. Saving makes an organisation copy that overrides it.</Text>}
          <ScrollArea.Autosize mah={360}>
            <Checkbox.Group {...form.getInputProps("permissions")}>
              <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
                {Object.entries(byResource).map(([res, list]) => (
                  <Stack key={res} gap={6}>
                    <Text size="sm" fw={500}>{res}</Text>
                    {list.map((p) => <Checkbox key={p} value={p} label={p.split(":")[1]} size="xs" />)}
                  </Stack>
                ))}
              </SimpleGrid>
            </Checkbox.Group>
          </ScrollArea.Autosize>
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={save.isPending}>Save role</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

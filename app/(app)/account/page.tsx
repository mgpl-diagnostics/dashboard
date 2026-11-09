"use client";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, Group, PasswordInput, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { useForm } from "@mantine/form";
import { modals } from "@mantine/modals";
import { useQuery } from "@tanstack/react-query";
import { zod4Resolver } from "mantine-form-zod-resolver";
import { z } from "zod";
import { DesktopIcon, DeviceMobileIcon } from "@phosphor-icons/react";
import { Enter } from "@/components/Enter";
import { Field } from "@/components/Field";
import { PageHeader } from "@/components/PageHeader";
import { QueryError } from "@/components/QueryError";
import { roleName } from "@/lib/access";
import { ago, dateTime } from "@/lib/format";
import { mgpl } from "@/lib/mgpl";
import { useAction } from "@/lib/queries";
import { useViewer } from "@/lib/viewer";

export default function AccountPage() {
  const { viewer } = useViewer();
  const u = viewer.user;
  const branch = (id: string | null) => (id ? viewer.organization.branches.find((b) => b.id === id)?.name ?? "A branch" : "All branches");
  return (
    <Enter>
      <PageHeader title="My account" />
      <Card data-enter>
        <SimpleGrid cols={{ base: 1, sm: 3 }}>
          <Field label="Name" value={u.name} />
          <Field label="Email" value={u.email} />
          <Field label="Roles" value={<Group gap={4}>{u.roles.map((r, k) => <Badge key={k} color="gray">{roleName(r.role)} · {branch(r.branchId)}</Badge>)}</Group>} />
        </SimpleGrid>
      </Card>
      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md" data-enter>
        <ChangePassword />
        <Sessions />
      </SimpleGrid>
    </Enter>
  );
}

const pw = z
  .object({ current: z.string().min(1, "Enter your current password"), next: z.string().min(10, "Use at least 10 characters"), confirm: z.string() })
  .refine((v) => v.next === v.confirm, { message: "The two passwords differ", path: ["confirm"] });

function ChangePassword() {
  const form = useForm({ initialValues: { current: "", next: "", confirm: "" }, validate: zod4Resolver(pw) });
  const change = useAction((v: { current: string; next: string }) => mgpl.auth.changePassword(v.current, v.next), { success: "Password changed. Other devices are signed out", onDone: () => form.reset() });
  return (
    <Card>
      <Title order={2} fz={17} mb="md">Change password</Title>
      <form onSubmit={form.onSubmit((v) => change.mutate(v))}>
        <Stack>
          <PasswordInput label="Current password" autoComplete="current-password" {...form.getInputProps("current")} />
          <PasswordInput label="New password" autoComplete="new-password" {...form.getInputProps("next")} />
          <PasswordInput label="New password again" autoComplete="new-password" {...form.getInputProps("confirm")} />
          <Group justify="flex-end"><Button type="submit" loading={change.isPending}>Change password</Button></Group>
        </Stack>
      </form>
    </Card>
  );
}

function Sessions() {
  const router = useRouter();
  const q = useQuery({ queryKey: ["mgpl", "sessions"], queryFn: () => mgpl.auth.sessions() });
  const refresh = [["mgpl", "sessions"]];
  const revoke = useAction((id: string) => mgpl.auth.revokeSession(id), { success: "Signed out that device", refresh });
  const others = useAction(() => mgpl.auth.logoutOtherSessions(), { success: (n) => `Signed out ${n} other device${n === 1 ? "" : "s"}`, refresh });
  return (
    <Card>
      <Group justify="space-between" mb="md">
        <Title order={2} fz={17}>Where you&apos;re signed in</Title>
        {(q.data?.length ?? 0) > 1 && <Button size="xs" variant="subtle" color="red" loading={others.isPending} onClick={() => others.mutate(undefined)}>Sign out the others</Button>}
      </Group>
      {q.isError && <QueryError error={q.error} />}
      <Stack gap={0}>
        {(q.data ?? []).map((s) => {
          const info = s.deviceInfo ?? {};
          const mobile = info.mobile === true;
          const Icon = mobile ? DeviceMobileIcon : DesktopIcon;
          return (
            <Group key={s.id} justify="space-between" py={10} wrap="nowrap" style={{ borderBottom: "1px solid var(--mantine-color-default-border)" }}>
              <Group gap="sm" wrap="nowrap" miw={0}>
                <Icon size={18} color="var(--mantine-color-dimmed)" />
                <Stack gap={0} miw={0}>
                  <Text size="sm" truncate>{[info.browser, info.os].filter(Boolean).join(" on ") || s.userAgent || "Unknown device"}</Text>
                  <Text size="xs" c="dimmed">Active {ago(s.lastSeenAt)} · since {dateTime(s.createdAt)}</Text>
                </Stack>
              </Group>
              {s.current ? <Badge color="tulsi">This device</Badge> : (
                <Button size="compact-xs" variant="subtle" color="gray" onClick={() => revoke.mutate(s.id)}>Sign out</Button>
              )}
            </Group>
          );
        })}
      </Stack>
      <Group justify="flex-end" mt="md">
        <Button
          variant="default"
          size="xs"
          onClick={() =>
            modals.openConfirmModal({
              title: "Sign out of this device?",
              labels: { confirm: "Sign out", cancel: "Stay" },
              onConfirm: async () => {
                await mgpl.auth.logout();
                router.replace("/login");
              },
            })
          }
        >
          Sign out here
        </Button>
      </Group>
    </Card>
  );
}

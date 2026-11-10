"use client";
import { Alert, Anchor, Badge, Button, Card, Code, CopyButton, Group, List, SimpleGrid, Stack, Text, Title, Tooltip, ActionIcon, Divider } from "@mantine/core";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowClockwiseIcon, CheckIcon, CopyIcon, ArrowSquareOutIcon, WarningIcon } from "@phosphor-icons/react";
import { Enter } from "@/components/Enter";
import { Guard } from "@/components/Guard";
import { PageHeader } from "@/components/PageHeader";
import { QueryError } from "@/components/QueryError";
import { ago, date } from "@/lib/format";
import { errorMessage } from "@/lib/mgpl";
import { COMPONENT_NAMES, fetchUpdates, useSystemUpdates, type ComponentUpdate } from "@/lib/updates";
import { notifications } from "@mantine/notifications";

export default function UpdatesPage() {
  return (
    <Guard permission="settings:manage">
      <Updates />
    </Guard>
  );
}

/** GitHub's generated notes are Markdown; shown as plain text, so drop heading marks, bold and bullets. */
const plain = (md: string) =>
  md.trim().split("\n").map((l) => l.replace(/^#{1,6}\s+/, "").replace(/^\s*[*-]\s+/, "• ").replace(/\*\*(.+?)\*\*/g, "$1")).join("\n");

/** A step that is a command gets a copy button; the rest is plain text. */
const COMMAND = /^docker compose [a-z -]+?(?=\s{2,}\(|$)/;

function Updates() {
  const q = useSystemUpdates();
  const qc = useQueryClient();
  const [checking, setChecking] = useState(false);

  async function checkNow() {
    setChecking(true);
    try {
      qc.setQueryData(["mgpl", "systemUpdates"], await fetchUpdates(true));
    } catch (err) {
      notifications.show({ color: "red", title: "Couldn't check for updates", message: errorMessage(err) });
    } finally {
      setChecking(false);
    }
  }

  const u = q.data;
  return (
    <Enter>
      <PageHeader
        title="Updates"
        description={u?.checkedAt ? `Versions on this server and the newest releases. Checked ${ago(u.checkedAt)}` : "Versions on this server and the newest releases"}
        actions={<Button variant="default" leftSection={<ArrowClockwiseIcon size={16} />} loading={checking} onClick={checkNow} disabled={!u?.enabled}>Check now</Button>}
      />
      {q.isError ? <QueryError error={q.error} retry={() => q.refetch()} /> : q.isPending ? null : !u ? (
        <Alert color="gray" data-enter title="Not available on this server yet">
          The server runs an api version without update checks. Update the api once by hand (docker compose pull, then docker compose up -d), and this page fills in.
        </Alert>
      ) : (
        <>
          {!u.enabled && (
            <Alert color="gray" data-enter title="Update checks are off">
              This server has UPDATE_CHECK=false, so it does not ask GitHub for new releases. The versions below are the ones running.
            </Alert>
          )}
          {u.error && <Alert color="yellow" icon={<WarningIcon size={18} />} data-enter>{u.error}</Alert>}
          <SimpleGrid cols={{ base: 1, sm: 2 }} data-enter>
            {u.components.map((c) => <VersionCard key={c.component} c={c} />)}
          </SimpleGrid>
          {u.updateAvailable && (
            <Card withBorder data-enter>
              <Stack gap="sm">
                <Title order={3}>How to update</Title>
                <Text size="sm" c="dimmed">Run these on the server, in the folder with docker-compose.yml. People stay signed in; the api restarts in a few seconds.</Text>
                <List type="ordered" spacing="xs" size="sm">
                  {u.steps.map((s) => {
                    const cmd = COMMAND.exec(s)?.[0];
                    return (
                      <List.Item key={s}>
                        {cmd ? (
                          <Group gap={6} wrap="wrap" align="center">
                            <Code style={{ whiteSpace: "nowrap" }}>{cmd}</Code>
                            <CopyButton value={cmd}>
                              {({ copied, copy }) => (
                                <Tooltip label={copied ? "Copied" : "Copy"}>
                                  <ActionIcon size="sm" variant="subtle" color="gray" onClick={copy} aria-label={`Copy ${cmd}`}>
                                    {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
                                  </ActionIcon>
                                </Tooltip>
                              )}
                            </CopyButton>
                            {s.length > cmd.length && <Text size="xs" c="dimmed">{s.slice(cmd.length).trim()}</Text>}
                          </Group>
                        ) : s}
                      </List.Item>
                    );
                  })}
                </List>
                <Anchor href={u.docsUrl} target="_blank" rel="noreferrer" size="sm">Full update guide</Anchor>
              </Stack>
            </Card>
          )}
          {u.components.filter((c) => c.updateAvailable && c.changes.length).map((c) => <Changelog key={c.component} c={c} />)}
        </>
      )}
    </Enter>
  );
}

function VersionCard({ c }: { c: ComponentUpdate }) {
  return (
    <Card withBorder>
      <Stack gap={6}>
        <Group justify="space-between" wrap="nowrap">
          <Text fw={500}>{COMPONENT_NAMES[c.component]}</Text>
          {c.updateAvailable ? <Badge color="saffron">Update available</Badge> : c.latest && c.current ? <Badge color="tulsi">Up to date</Badge> : <Badge color="gray">Unknown</Badge>}
        </Group>
        <Group gap="xs" className="figure">
          <Text size="xl" fw={600}>{c.current ? `v${c.current}` : "–"}</Text>
          {c.updateAvailable && <Text size="xl" c="dimmed">→ v{c.latest}</Text>}
        </Group>
        <Text size="xs" c="dimmed" ff="monospace" style={{ overflowWrap: "anywhere" }}>{c.image}:{c.latest ?? c.current ?? "latest"}</Text>
      </Stack>
    </Card>
  );
}

function Changelog({ c }: { c: ComponentUpdate }) {
  return (
    <Card withBorder data-enter>
      <Stack gap="md">
        <Title order={3}>What changed in the {COMPONENT_NAMES[c.component].toLowerCase()}</Title>
        {c.changes.map((r, i) => (
          <Stack key={r.version} gap={6}>
            {i > 0 && <Divider />}
            <Group justify="space-between" wrap="wrap" gap="xs">
              <Group gap="xs">
                <Text fw={600} className="figure">v{r.version}</Text>
                {r.name && r.name !== `v${r.version}` && <Text size="sm" c="dimmed">{r.name}</Text>}
              </Group>
              <Group gap="sm">
                {r.publishedAt && <Text size="xs" c="dimmed">{date(r.publishedAt)}</Text>}
                {r.url && (
                  <Anchor href={r.url} target="_blank" rel="noreferrer" size="xs">
                    <Group gap={4} wrap="nowrap">Release page <ArrowSquareOutIcon size={12} /></Group>
                  </Anchor>
                )}
              </Group>
            </Group>
            {/* release notes are Markdown from GitHub: shown as text, never as HTML */}
            <Text size="sm" style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{r.notes?.trim() ? plain(r.notes) : "No notes for this release."}</Text>
          </Stack>
        ))}
      </Stack>
    </Card>
  );
}

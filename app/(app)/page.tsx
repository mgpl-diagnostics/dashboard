"use client";
import { useMemo } from "react";
import Link from "next/link";
import { Anchor, Card, Grid, Group, SimpleGrid, Skeleton, Stack, Text, Title } from "@mantine/core";
import { AreaChart } from "@mantine/charts";
import { useQuery } from "@tanstack/react-query";
import type { Gql } from "@mgpl-diagnostics/client";
import { Enter } from "@/components/Enter";
import { Figure } from "@/components/Figure";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { TubeCap } from "@/components/TubeCap";
import { dayjs, IST, isToday, rupeesShort, time } from "@/lib/format";
import { mgpl } from "@/lib/mgpl";
import { useBookings, useInvoices } from "@/lib/queries";
import { useViewer } from "@/lib/viewer";

interface Task { key: string; title: string; meta: string; href: string; sampleType?: string | null; status: string }

export default function TodayPage() {
  const { viewer, can, branchId } = useViewer();
  const bookings = useBookings();
  const dues = useInvoices({ limit: 200 }, can("invoice:read"));
  const outstanding = useQuery({
    queryKey: ["mgpl", "books", "outstanding", branchId],
    queryFn: () => mgpl.books.outstandingReceivables(branchId ? { branchId } : {}),
    enabled: can("accounts:read"),
  });

  const list = useMemo(() => bookings.data ?? [], [bookings.data]);
  const today = list.filter((b) => isToday(b.createdAt) && b.status !== "cancelled");
  const toCollect = list.flatMap((b) => (b.status === "cancelled" ? [] : b.samples.filter((s) => s.status === "pending").map((s) => ({ b, s }))));
  const toReceive = list.flatMap((b) => b.samples.filter((s) => s.status === "collected").map((s) => ({ b, s })));
  const reports = list.flatMap((b) => b.reports.map((r) => ({ b, r })));
  const toVerify = reports.filter((x) => x.r.status === "entered");
  const toRelease = reports.filter((x) => x.r.status === "verified");
  const unpaid = (dues.data ?? []).filter((i) => i.duePaise > 0 && i.status !== "cancelled");
  const duePaise = can("accounts:read") ? (outstanding.data?.totalDuePaise ?? 0) : unpaid.reduce((s, i) => s + i.duePaise, 0);

  // Bookings per day for the last 14 days (IST); today carries the accent.
  const trend = useMemo(() => {
    const start = dayjs().tz(IST).startOf("day").subtract(13, "day");
    const days = Array.from({ length: 14 }, (_, i) => start.add(i, "day"));
    const count = new Map(days.map((d) => [d.format("YYYY-MM-DD"), 0]));
    for (const b of list) {
      const k = dayjs(b.createdAt).tz(IST).format("YYYY-MM-DD");
      if (count.has(k) && b.status !== "cancelled") count.set(k, count.get(k)! + 1);
    }
    return days.map((d) => ({ day: d.format("D MMM"), Bookings: count.get(d.format("YYYY-MM-DD"))! }));
  }, [list]);

  // What this person should do next, by what their role allows. One list, most urgent first.
  const tasks: Task[] = [
    ...(can("report:verify") ? toVerify.map(({ b, r }) => ({ key: r.id, title: `Verify ${r.testName}`, meta: `${b.patient.name} · ${b.bookingNo}`, href: `/reports?booking=${b.id}`, status: r.status })) : []),
    ...(can("report:release") ? toRelease.map(({ b, r }) => ({ key: r.id, title: `Release ${r.testName}`, meta: `${b.patient.name} · ${b.bookingNo}`, href: `/reports?booking=${b.id}`, status: r.status })) : []),
    ...(can("sample:receive") ? toReceive.map(({ b, s }) => ({ key: s.id, title: `Receive ${s.barcode}`, meta: `${b.patient.name} · collected ${time(s.collectedAt)}`, href: `/samples?q=${s.barcode}`, sampleType: s.sampleType, status: s.status })) : []),
    ...(can("sample:collect") ? toCollect.map(({ b, s }) => ({ key: s.id, title: `Collect ${s.barcode}`, meta: `${b.patient.name} · ${b.sampleCollection.type === "home" ? "home visit" : "walk-in"}`, href: `/samples?q=${s.barcode}`, sampleType: s.sampleType, status: s.status })) : []),
    ...(can("payment:create") ? unpaid.slice(0, 20).map((i) => ({ key: i.id, title: `Collect ${rupeesShort(i.duePaise)}`, meta: `${i.patient.name} · ${i.invoiceNo}`, href: `/invoices?id=${i.id}`, status: i.status })) : []),
  ];

  const stats: { label: string; value: number; note: string; money?: boolean; show: boolean }[] = [
    { label: "Bookings today", value: today.length, note: `${list.filter((b) => isToday(b.createdAt) && b.sampleCollection.type === "home").length} home visits`, show: can("booking:read") },
    { label: "Samples to collect", value: toCollect.length, note: `${toReceive.length} waiting at the lab`, show: can("sample:read") },
    { label: "Reports to verify", value: toVerify.length, note: `${toRelease.length} ready to release`, show: can("report:read") },
    { label: can("accounts:read") ? "Outstanding" : "Due on bills", value: duePaise, money: true, note: can("accounts:read") ? "All open invoices" : `${unpaid.length} bills with a balance`, show: can("invoice:read") || can("accounts:read") },
  ];
  const shown = stats.filter((s) => s.show);
  const loading = bookings.isPending && can("booking:read");

  return (
    <Enter>
      <PageHeader title={dayjs().tz(IST).format("dddd, D MMMM")} description={`${viewer.organization.name}${branchId ? ` · ${viewer.organization.branches.find((b) => b.id === branchId)?.name ?? ""}` : ""}`} />

      {shown.length > 0 && (
        <SimpleGrid cols={{ base: 2, md: shown.length }} spacing="md" data-enter>
          {shown.map((s) => (
            <Card key={s.label} padding="lg">
              <Text size="sm" c="dimmed">{s.label}</Text>
              {loading ? <Skeleton h={30} mt={12} w={80} /> : <Figure mt={12} value={s.value} format={s.money ? rupeesShort : undefined} />}
              <Text size="xs" c="dimmed" mt={8}>{s.note}</Text>
            </Card>
          ))}
        </SimpleGrid>
      )}

      <Grid gap="md" data-enter>
        {can("booking:read") && (
          <Grid.Col span={{ base: 12, lg: 8 }}>
          <Card h="100%">
            <Group justify="space-between" mb="md">
              <Title order={2} fz={17}>Bookings, last 14 days</Title>
              <Text size="xs" c="dimmed" className="figure">{trend.reduce((s, d) => s + d.Bookings, 0)} in total</Text>
            </Group>
            {loading ? (
              <Skeleton h={300} />
            ) : (
              <AreaChart
                h={300}
                data={trend}
                dataKey="day"
                series={[{ name: "Bookings", color: "saffron.6" }]}
                curveType="monotone"
                gridAxis="x"
                withDots={false}
                fillOpacity={0.18}
                tickLine="none"
                yAxisProps={{ allowDecimals: false, width: 32 }}
              />
            )}
          </Card>
          </Grid.Col>
        )}

        <Grid.Col span={{ base: 12, lg: can("booking:read") ? 4 : 12 }}>
        <Card h="100%">
          <Group justify="space-between" mb="sm">
            <Title order={2} fz={17}>Waiting on you</Title>
            <Text size="xs" c="dimmed" className="figure">{tasks.length}</Text>
          </Group>
          {loading ? (
            <Stack gap={8}>{[0, 1, 2, 3].map((i) => <Skeleton key={i} h={44} />)}</Stack>
          ) : tasks.length === 0 ? (
            <Text size="sm" c="dimmed">Nothing is waiting. New work shows up here as it arrives.</Text>
          ) : (
            <Stack gap={0}>
              {tasks.slice(0, 6).map((t) => (
                <Anchor key={t.key} component={Link} href={t.href} underline="never" c="inherit" py={10} style={{ borderBottom: "1px solid var(--mantine-color-default-border)" }}>
                  <Group justify="space-between" wrap="nowrap" gap="sm">
                    <Stack gap={2} miw={0}>
                      <Group gap={8} wrap="nowrap">
                        {t.sampleType !== undefined && <TubeCap sampleType={t.sampleType} withLabel={false} />}
                        <Text size="sm" fw={500} truncate>{t.title}</Text>
                      </Group>
                      <Text size="xs" c="dimmed" truncate>{t.meta}</Text>
                    </Stack>
                    <StatusBadge status={t.status} />
                  </Group>
                </Anchor>
              ))}
              {tasks.length > 6 && <Text size="xs" c="dimmed" pt="sm">{tasks.length - 6} more in the worklists</Text>}
            </Stack>
          )}
        </Card>
        </Grid.Col>
      </Grid>

      {can("booking:read") && <RecentBookings list={list.slice(0, 6)} />}

      {!can("booking:read") && can("patient:read") && (
        <Card data-enter>
          <Title order={2} fz={17} mb={4}>Your patients</Title>
          <Text size="sm" c="dimmed" mb="md">Search by name, phone or UHID to open a patient.</Text>
          <Anchor component={Link} href="/patients" size="sm">Find a patient</Anchor>
        </Card>
      )}
    </Enter>
  );
}

function RecentBookings({ list }: { list: Gql.Booking[] }) {
  if (!list.length) return null;
  return (
    <Card data-enter>
      <Group justify="space-between" mb="sm">
        <Title order={2} fz={17}>Latest bookings</Title>
        <Anchor component={Link} href="/bookings" size="sm">All bookings</Anchor>
      </Group>
      <Stack gap={0}>
        {list.map((b) => (
          <Group key={b.id} justify="space-between" py={10} wrap="nowrap" style={{ borderBottom: "1px solid var(--mantine-color-default-border)" }}>
            <Stack gap={2} miw={0}>
              <Text size="sm" fw={500} truncate>{b.patient.name}</Text>
              <Text size="xs" c="dimmed" truncate>{b.tests.map((t) => t.name).join(", ")}</Text>
            </Stack>
            <Group gap="md" wrap="nowrap">
              <Text size="xs" c="dimmed" ff="monospace" visibleFrom="sm">{b.bookingNo}</Text>
              <StatusBadge status={b.status} />
            </Group>
          </Group>
        ))}
      </Stack>
    </Card>
  );
}

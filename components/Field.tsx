import { Stack, Text } from "@mantine/core";
import type { ReactNode } from "react";

/** A label over a value, for detail panels. */
export function Field({ label, value, mono }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <Stack gap={2}>
      <Text size="xs" c="dimmed">{label}</Text>
      <Text size="sm" component="div" ff={mono ? "monospace" : undefined} className={mono ? "figure" : undefined}>{value}</Text>
    </Stack>
  );
}

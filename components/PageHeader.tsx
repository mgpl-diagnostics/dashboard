import { Group, Stack, Text, Title } from "@mantine/core";
import type { ReactNode } from "react";

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <Group justify="space-between" align="flex-end" gap="md" data-enter>
      <Stack gap={4}>
        <Title order={1}>{title}</Title>
        {description && <Text c="dimmed" size="sm">{description}</Text>}
      </Stack>
      {actions && <Group gap="xs">{actions}</Group>}
    </Group>
  );
}

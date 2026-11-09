import { Group, Text } from "@mantine/core";
import { DropIcon } from "@phosphor-icons/react/dist/ssr";

/** The product name in the main family plus the lotus-drop mark's colour. No gradient, no tile. */
export function Brand({ compact }: { compact?: boolean }) {
  return (
    <Group gap={8} wrap="nowrap">
      <DropIcon size={22} weight="fill" color="var(--mantine-color-saffron-6)" aria-hidden />
      <Text ff="heading" fw={500} fz={compact ? 16 : 18} lh={1}>
        MGPL <Text span inherit c="dimmed" fw={400} visibleFrom={compact ? "sm" : undefined}>Dashboard</Text>
      </Text>
    </Group>
  );
}

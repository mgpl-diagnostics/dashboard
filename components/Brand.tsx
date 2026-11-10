import { Box, Group, Text } from "@mantine/core";
import Image from "next/image";

/**
 * The real MGPL Diagnostics logo, copied from the website repo (public/logo*.svg).
 * Light and dark are separate drawn files, as the website's design system asks: never filter the logo.
 * `compact` is the navbar lockup (904 × 372); the full lockup (920 × 388) goes on the sign-in page.
 */
export function Brand({ compact }: { compact?: boolean }) {
  const file = compact ? "logo-compact" : "logo";
  const [w, h] = compact ? [904, 372] : [920, 388];
  const height = compact ? 30 : 56;
  const width = Math.round((height * w) / h);
  const img = (src: string) => (
    <Image src={src} alt="MGPL Diagnostics" width={width} height={height} priority unoptimized style={{ display: "block" }} />
  );
  return (
    <Group gap={10} wrap="nowrap">
      <Box darkHidden>{img(`/${file}.svg`)}</Box>
      <Box lightHidden>{img(`/${file}-dark.svg`)}</Box>
      {compact && (
        <Text ff="heading" fw={400} fz={15} lh={1} c="dimmed" visibleFrom="sm">
          Dashboard
        </Text>
      )}
    </Group>
  );
}

import { Box, Center, Stack, Text } from "@mantine/core";
import type { ReactNode } from "react";
import { Brand } from "@/components/Brand";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <Center mih="100dvh" p="md" bg="light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-7))">
      <Stack w="100%" maw={400} gap="lg">
        <Brand />
        <Box>{children}</Box>
        <Text size="xs" c="dimmed">
          Maa Gayatri Path Lab staff only. Every sign-in is tied to this device and recorded
        </Text>
      </Stack>
    </Center>
  );
}

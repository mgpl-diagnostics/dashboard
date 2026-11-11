import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Box, Center, Stack, Text } from "@mantine/core";
import { Brand } from "@/components/Brand";

// The patient's page behind the QR on reports and bills. Public (no sign-in, no app shell): the token in the
// URL is the only key, so the page sends no Referer anywhere and stays out of every index.
export const metadata: Metadata = {
  title: "Your reports",
  referrer: "no-referrer",
  openGraph: { title: "MGPL Diagnostics", description: "Your bill and reports.", type: "website" },
};

export default function PatientLayout({ children }: { children: ReactNode }) {
  return (
    <Center mih="100dvh" p="md" bg="light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-7))" style={{ alignItems: "flex-start" }}>
      <Stack w="100%" maw={560} gap="lg" py="lg">
        <Brand />
        <Box>{children}</Box>
        <Text size="xs" c="dimmed">
          This page shows one booking only. Keep the link to yourself: anyone who has it can open these reports
        </Text>
      </Stack>
    </Center>
  );
}

"use client";
import Link from "next/link";
import { Button, Center, Stack, Text, Title } from "@mantine/core";

export default function NotFound() {
  return (
    <Center mih="100dvh" p="md">
      <Stack align="center" gap="sm">
        <Title order={1}>Page not found</Title>
        <Text c="dimmed">The link may be old. Start again from Today</Text>
        <Button component={Link} href="/">Go to Today</Button>
      </Stack>
    </Center>
  );
}

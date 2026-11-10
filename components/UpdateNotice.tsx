"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Alert, Anchor, Group, Text } from "@mantine/core";
import { useLocalStorage } from "@mantine/hooks";
import { ArrowCircleUpIcon } from "@phosphor-icons/react";
import { COMPONENT_NAMES, pendingUpdates, useSystemUpdates } from "@/lib/updates";

/** Owners and admins: one quiet line when a newer api or dashboard release is out. Dismissed per release. */
export function UpdateNotice() {
  const q = useSystemUpdates();
  const pathname = usePathname();
  const [dismissed, setDismissed] = useLocalStorage<string>({ key: "mgpl.dashboard.updateDismissed", defaultValue: "" });
  const { list, key } = pendingUpdates(q.data);
  if (!list.length || dismissed === key || pathname === "/updates") return null;
  return (
    <Alert
      color="saffron"
      variant="light"
      py="xs"
      mb="lg"
      icon={<ArrowCircleUpIcon size={18} />}
      withCloseButton
      closeButtonLabel="Hide until the next release"
      onClose={() => setDismissed(key)}
    >
      <Group gap="xs" wrap="wrap">
        <Text size="sm" fw={500}>Update available</Text>
        <Text size="sm" className="figure">
          {list.map((c) => `${COMPONENT_NAMES[c.component]} ${c.current} → ${c.latest}`).join(" · ")}
        </Text>
        <Anchor component={Link} href="/updates" size="sm">See what changed</Anchor>
      </Group>
    </Alert>
  );
}

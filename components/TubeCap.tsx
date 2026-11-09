import { Group, Text, Tooltip } from "@mantine/core";
import { tubeFor } from "@/lib/tubes";

/** The sample type with its tube's cap colour: the dashboard's signature detail. */
export function TubeCap({ sampleType, withLabel = true }: { sampleType: string | null | undefined; withLabel?: boolean }) {
  const t = tubeFor(sampleType);
  return (
    <Tooltip label={t.label}>
      <Group gap={8} wrap="nowrap" component="span" display="inline-flex">
        <span aria-hidden style={{ width: 10, height: 10, borderRadius: 3, background: t.cap, flex: "none", boxShadow: "inset 0 -2px 0 rgba(0,0,0,0.18)" }} />
        {withLabel && <Text span size="sm">{sampleType ?? "Not set"}</Text>}
      </Group>
    </Tooltip>
  );
}

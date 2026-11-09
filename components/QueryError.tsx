"use client";
import { Alert, Button } from "@mantine/core";
import { WarningCircleIcon } from "@phosphor-icons/react";
import { errorMessage } from "@/lib/mgpl";

export function QueryError({ error, retry }: { error: unknown; retry?: () => void }) {
  return (
    <Alert color="red" icon={<WarningCircleIcon size={18} />} title="Couldn't load this" role="alert">
      {errorMessage(error)}
      {retry && (
        <Button mt="sm" size="xs" variant="light" color="red" onClick={retry}>
          Try again
        </Button>
      )}
    </Alert>
  );
}

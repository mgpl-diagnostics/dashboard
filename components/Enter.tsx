"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { Stack, type StackProps } from "@mantine/core";
import { enter } from "@/lib/motion";

/** The page body: its `[data-enter]` blocks fade and rise once when the page opens (anime.js). */
export function Enter({ children, ...props }: { children: ReactNode } & StackProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => enter(ref.current), []);
  return (
    <Stack ref={ref} gap="lg" {...props}>
      {children}
    </Stack>
  );
}

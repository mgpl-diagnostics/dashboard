"use client";
import { useEffect, useRef } from "react";
import { Text, type TextProps } from "@mantine/core";
import { countTo } from "@/lib/motion";

/** A number that tweens to its new value with anime.js (instant for reduced motion). */
export function Figure({ value, format = (n) => n.toLocaleString("en-IN"), ...props }: { value: number; format?: (n: number) => string } & TextProps) {
  const ref = useRef<HTMLParagraphElement>(null);
  const last = useRef(0);
  useEffect(() => {
    const from = last.current;
    last.current = value;
    return countTo(ref.current, from, value, format);
  }, [value, format]);
  return (
    <Text ref={ref} className="figure" ff="heading" fz={30} fw={500} lh={1} {...props}>
      {format(value)}
    </Text>
  );
}

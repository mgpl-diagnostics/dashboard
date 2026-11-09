"use client";
import { useState, type ReactNode } from "react";
import { MantineProvider } from "@mantine/core";
import { DatesProvider } from "@mantine/dates";
import { ModalsProvider } from "@mantine/modals";
import { Notifications } from "@mantine/notifications";
import { NavigationProgress } from "@mantine/nprogress";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { clearOnSignOut } from "@mgpl-diagnostics/client";
import { theme } from "@/lib/theme";
import { errorCode, session } from "@/lib/mgpl";
import "dayjs/locale/en-in";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => {
    const qc = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 30_000,
          refetchOnWindowFocus: true,
          // Permission and validation errors don't get better by retrying.
          retry: (count, err) => !["FORBIDDEN", "NOT_FOUND", "BAD_USER_INPUT", "UNAUTHENTICATED"].includes(errorCode(err) ?? "") && count < 2,
        },
      },
    });
    clearOnSignOut(session, qc);
    return qc;
  });

  return (
    <MantineProvider theme={theme} defaultColorScheme="auto">
      <DatesProvider settings={{ locale: "en-in", firstDayOfWeek: 1 }}>
        <QueryClientProvider client={queryClient}>
          <NavigationProgress />
          <Notifications position="top-right" limit={4} />
          <ModalsProvider labels={{ confirm: "Confirm", cancel: "Cancel" }}>{children}</ModalsProvider>
          <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
        </QueryClientProvider>
      </DatesProvider>
    </MantineProvider>
  );
}

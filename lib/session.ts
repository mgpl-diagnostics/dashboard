"use client";
import { useSyncExternalStore } from "react";
import type { SessionSnapshot } from "@mgpl-diagnostics/client";
import { session } from "./mgpl";

/** The session, or null while the page hydrates (the server never knows who is signed in). */
export function useSession(): SessionSnapshot | null {
  return useSyncExternalStore(session.subscribe, session.getSnapshot, () => null);
}

// Partner-lab imports (api docs/18-imports.md): shared labels and the error messages people see.
import type { Gql } from "@mgpl-diagnostics/client";
import { errorCode, errorMessage } from "./mgpl";

export const LAB_NAMES: Record<Gql.ExternalLab, string> = { hypatho: "Hy Patho Lab", clinova: "Clinova Pathlabs" };
export const labName = (lab: Gql.ExternalLab) => LAB_NAMES[lab] ?? lab;

export const SIGNATORY_ROLES: { value: Gql.ExternalSignatoryRole; label: string }[] = [
  { value: "pathologist", label: "Pathologist" },
  { value: "biochemist", label: "Biochemist" },
  { value: "microbiologist", label: "Microbiologist" },
  { value: "consultant", label: "Consultant" },
  { value: "manager", label: "Lab manager (not medical)" },
  { value: "unknown", label: "Not known" },
];

/** The import-specific api codes in words; everything else as errorMessage does it. */
export function importErrorMessage(err: unknown): string {
  switch (errorCode(err)) {
    case "UNSUPPORTED_REPORT":
      return "This PDF isn't a report the reader knows (Hy Patho Lab or Clinova Pathlabs). Nothing was kept";
    case "FILE_TOO_LARGE":
      return "This PDF is larger than the server accepts";
    case "REPORT_ALREADY_APPLIED":
      return "This partner report was applied already";
    default:
      return errorMessage(err);
  }
}

export const fileSize = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

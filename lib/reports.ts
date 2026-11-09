"use client";
// Report calls with our own selection. The client's typed report methods (1.4) also select
// `provenance` (partner-lab imports), which the api only serves once that feature is deployed; these
// selections work on either api version.
import type { Gql } from "@mgpl-diagnostics/client";
import { mgpl } from "./mgpl";

const FIELDS = "id testCode testName status version verifiedAt releasedAt updatedAt results { parameter value unit flag range }";
export type Report = Omit<Gql.Report, "provenance">;

const one = async <K extends string>(field: K, doc: string, vars: Record<string, unknown>) =>
  (await mgpl.request<Record<K, Report>>(doc, vars))[field];

export const reports = {
  get: (id: string) => one("report", `query Report($id: ID!) { report(id: $id) { ${FIELDS} } }`, { id }),
  create: (bookingId: string, testCode: string, testName?: string) =>
    one("createReport", `mutation CreateReport($bookingId: ID!, $testCode: String!, $testName: String) { createReport(bookingId: $bookingId, testCode: $testCode, testName: $testName) { ${FIELDS} } }`, { bookingId, testCode, testName }),
  saveResults: (reportId: string, results: Gql.ResultInput[]) =>
    one("saveResults", `mutation SaveResults($reportId: ID!, $results: [ResultInput!]!) { saveResults(reportId: $reportId, results: $results) { ${FIELDS} } }`, { reportId, results }),
  verify: (id: string) => one("verifyReport", `mutation VerifyReport($id: ID!) { verifyReport(id: $id) { ${FIELDS} } }`, { id }),
  release: (id: string) => one("releaseReport", `mutation ReleaseReport($id: ID!) { releaseReport(id: $id) { ${FIELDS} } }`, { id }),
  amend: (id: string) => one("amendReport", `mutation AmendReport($id: ID!) { amendReport(id: $id) { ${FIELDS} } }`, { id }),
};

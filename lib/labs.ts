"use client";
// One person, several labs (api: myOrganizations, switchOrganization, ORG_REQUIRED's extensions.organizations).
// Client 1.5 has these as auth.organizations / auth.switchOrganization / organizationChoices; written here with
// mgpl.request so the app works on an api without them (no labs → no switcher).
import { MgplGraphQLError, type Gql } from "@mgpl-diagnostics/client";
import { mgpl, session } from "./mgpl";

export type Lab = { code: string; name: string; current: boolean };

/** The labs to pick from after login failed with ORG_REQUIRED; empty for anything else. */
export function labChoices(err: unknown): { code: string; name: string }[] {
  if (!(err instanceof MgplGraphQLError) || err.code !== "ORG_REQUIRED") return [];
  const list = err.errors[0]?.extensions?.organizations;
  if (!Array.isArray(list)) return [];
  return list.filter((o): o is { code: string; name: string } => !!o && typeof o.code === "string" && typeof o.name === "string").map(({ code, name }) => ({ code, name }));
}

export const labs = {
  /** Every lab this person can work in; [] when the api doesn't offer it yet. */
  async mine(): Promise<Lab[]> {
    try {
      return (await mgpl.request<{ myOrganizations: Lab[] }>("query MyOrganizations { myOrganizations { code name current } }")).myOrganizations;
    } catch (err) {
      if (err instanceof MgplGraphQLError && err.code === "GRAPHQL_VALIDATION_FAILED") return [];
      throw err;
    }
  },
  /**
   * Moves the session to the person's account in that lab (no password). The api sets the new session as
   * cookies (the token fields come back null); the session manager keeps only its expiry and user.
   */
  async switchTo(orgCode: string): Promise<void> {
    const device = await session.device();
    const r = await mgpl.request<{ switchOrganization: Gql.LoginResult }>(
      "mutation SwitchOrganization($orgCode: String!, $device: DeviceInput) { switchOrganization(orgCode: $orgCode, device: $device) { accessToken accessExpiresAt refreshToken refreshExpiresAt user { id name email phone status roles { role branchId } lastLoginAt createdAt } } }",
      { orgCode, device },
    );
    session.signIn(r.switchOrganization);
  },
};

# MGPL Dashboard

The staff dashboard of **Maa Gayatri Path Lab** (MGPL Diagnostics): one app where every role does its
day's work, on top of the GraphQL [api](https://github.com/mgpl-diagnostics/api). The public website
lives in [mgpl-diagnostics/website](https://github.com/mgpl-diagnostics/website); this is a separate app.

## What each role sees

The menu, the "Waiting on you" list and every button follow the signed-in user's permissions
(auth-kit's `SYSTEM_ROLES`, or the organisation's own roles). The api checks every call again.

| Role | Lands on | Does |
| --- | --- | --- |
| Owner, Administrator | Today | everything: users and roles, branches, doctors, audit log, accounts |
| Branch manager | Today | patients, bookings, samples, release reports, invoices, payments, receivables |
| Front desk | Today | register patients, book tests, bill, take payments, print invoices |
| Phlebotomist | Samples, "To collect" | collect samples by barcode, home visits |
| Lab technician | Samples, "To receive"; Reports, "To enter" | receive or reject samples, enter results, import partner-lab PDFs |
| Pathologist | Reports, "To verify" | verify, release, amend, print reports; import partner-lab PDFs and name partner signatures |
| Accountant | Accounts | P&L, balance sheet, trial balance, cash book, ledgers, vouchers by hand, receivables ageing, day book, GST, CSV exports, refunds, B2B customers and credit notes, partner settlements |
| Referring doctor | Today, then Patients | look up their patients (reading reports needs an api query that doctors may call; see the PR) |

## Pages

Today · Patients · Bookings · Samples · Reports · Partner imports (upload a Hy Patho / Clinova PDF, match it to a booking,
map its tests to ours, apply as entered results, name unknown signatures; the partner signatory registry) · Invoices · Accounts (P&L, balance sheet, trial balance, receivables, day book, cash book, ledgers with statements, GST; post or cancel vouchers by hand) · B2B customers (hospitals, insurers, TPAs, corporates: credit terms,
statements, ageing, credit invoices, credit notes; Credit note on an invoice) · Settlements (collection centres and franchises:
partners, agreements, monthly settlement with deductions and TDS, accrue, pay, CSV) · Doctors · Users and roles ·
Branches · Audit log · Updates (owner and admin: new releases, what changed, how to update) · My account (password, signed-in devices). Ctrl K (or /) opens search for pages and actions.

## Stack

| Need | Package |
| --- | --- |
| Framework | Next.js 16 (App Router, Turbopack), React 19, TypeScript |
| API, sign-in, tokens, refresh, device binding | `@mgpl-diagnostics/client` |
| Components, layout, dark mode | Mantine 9: core, dates, charts (Recharts), modals, notifications, spotlight, nprogress |
| Tables | mantine-datatable (sorting, paging, selection, row expansion, responsive columns) |
| Forms and validation | @mantine/form + zod (mantine-form-zod-resolver) |
| Data fetching and cache | TanStack Query |
| Motion | GSAP ScrollSmoother (smooth scroll), anime.js (entrances, number tweens) |
| Icons | Phosphor |
| Dates | dayjs (IST) |

## Run

```bash
cp .env.example .env.local     # MGPL_API_URL=http://localhost:4000
npm install                    # needs NODE_AUTH_TOKEN with read:packages for @mgpl-diagnostics/client
npm run dev                    # http://localhost:3001
```

Start the api first (see its docs/03-getting-started.md) and sign in with a user it seeded.

## Docker

Every release publishes `ghcr.io/mgpl-diagnostics/dashboard:<version>` (and `:latest`) for linux/amd64 and
linux/arm64, built by `.github/workflows/release.yml` from a `v*` tag that equals `package.json`'s version.

```bash
docker run -p 3000:3000 -e MGPL_API_URL=http://your-api:4000 ghcr.io/mgpl-diagnostics/dashboard:latest
```

`MGPL_API_URL` is read when the container starts (`proxy.ts`). Optional `MGPL_PUBLIC_API_URL` (also read at run
time) sends the browser straight to the api, e.g. `https://api.example.in:8443/graphql`, so the api's own TLS
proxy sees the browser's handshake (JA4 fingerprint) and IP; list the dashboard's origin in the api's
`CORS_ORIGINS`. `NEXT_PUBLIC_MGPL_ORG_CODE` is fixed at build
time, so the published image never sends one. To host everything (api, worker, databases, dashboard, nginx)
on one server, use the api's `docker-compose.yml`; its guide is the api's
[docs/19-updates.md](https://github.com/mgpl-diagnostics/api/blob/main/docs/19-updates.md), which also covers
updating. Owners and admins see "Update available: vX → vY" in the dashboard when either part has a newer
release, with the release notes and the update commands on the Updates page.

## How it works

- The browser calls `/graphql` on the dashboard's own origin; `proxy.ts` forwards it to `MGPL_API_URL`, so there
  is no CORS and the api address stays on the server. With `MGPL_PUBLIC_API_URL` set, the root layout writes
  that address into `<head>` (`lib/api-url.ts`) and the browser calls the api directly; the CSP (`lib/csp.ts`,
  set per request in `proxy.ts`) then allows that one origin in `connect-src`.
- Tokens: a 15-minute access JWT and a single-use refresh token, held by the api in **httpOnly cookies**
  (`__Host-mgpl_access`, `__Host-mgpl_refresh`; Secure, SameSite=Strict). No script on the page can read
  them. The client's session manager runs in cookie mode: every request sends `x-mgpl-auth: cookie` (the
  api's CSRF check), and localStorage keeps only the expiry times and the user, so tabs stay in step and the
  refresh runs once for all of them. Signing out, or a refresh from another device, ends the session;
  cached data is cleared. Needs an api with cookie sessions; outside docker-compose, its `CORS_ORIGINS`
  must list the dashboard's origin.
- Pages render per request only to read `MGPL_PUBLIC_API_URL` (the HTML is a shell); data loads in the browser
  with TanStack Query.
- Staff only, so never in search or AI indexes: `app/robots.ts` disallows everything, every page has a
  `noindex, nofollow` robots meta tag, and every response an `X-Robots-Tag` header (`next.config.ts`). Each
  section sets its tab title in its own `layout.tsx`; `app/manifest.ts` lets staff install the app. Search
  work for the public belongs in mgpl-diagnostics/website.

## Licence

All rights reserved (see LICENSE).

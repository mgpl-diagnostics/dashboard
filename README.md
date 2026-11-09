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
| Lab technician | Samples, "To receive"; Reports, "To enter" | receive or reject samples, enter results |
| Pathologist | Reports, "To verify" | verify, release, amend, print reports |
| Accountant | Accounts | P&L, trial balance, receivables ageing, day book, GST, CSV exports, refunds |
| Referring doctor | Today, then Patients | look up their patients (reading reports needs an api query that doctors may call; see the PR) |

## Pages

Today · Patients · Bookings · Samples · Reports · Invoices · Accounts · Doctors · Users and roles ·
Branches · Audit log · My account (password, signed-in devices). Ctrl K (or /) opens search for pages and actions.

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

## How it works

- The browser calls `/graphql` on the dashboard's own origin; Next forwards it to `MGPL_API_URL`, so there
  is no CORS and the api address stays on the server.
- Tokens: a 15-minute access JWT and a single-use refresh token, kept by the client's session manager
  (localStorage, shared across tabs, refreshed once for all tabs). Signing out, or a refresh from another
  device, ends the session; cached data is cleared.
- Every page is static; data loads in the browser with TanStack Query.

## Licence

All rights reserved (see LICENSE).

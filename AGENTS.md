# AGENTS.md — mgpl-diagnostics/dashboard

The staff dashboard of MGPL Diagnostics: **one Next.js app for every role** (owner, admin, branch manager,
front desk, phlebotomist, technician, pathologist, accountant, referring doctor) on the GraphQL api
([mgpl-diagnostics/api](https://github.com/mgpl-diagnostics/api)). It is separate from the public website.

## Map

```
app/(auth)/              sign-in, password reset (no shell)
app/(app)/               signed-in pages, one folder per menu item; layout.tsx mounts AppFrame
components/AppFrame.tsx  session check → viewer → AppShell (header, role-filtered sidebar, Spotlight, branch picker)
components/SmoothScroll.tsx  GSAP ScrollSmoother around the content column
components/booking/ report/  drawers and forms shared by several pages
lib/mgpl.ts              THE client (@mgpl-diagnostics/client): session manager, tokens, refresh, device signals
lib/access.ts            menu, role names, permission matching (mirrors auth-kit's rbac.ts)
lib/viewer.tsx           viewer context: can(permission), branches, picked branch
lib/queries.ts           TanStack Query hooks + useAction (mutation + toast + refresh)
lib/reports.ts           report calls with a selection that works with every api version
lib/table.ts             client-side sort/filter/paging for mantine-datatable
lib/motion.ts            anime.js entrance and number tweens
lib/theme.ts             Mantine theme: "Saffron & Neel" accent on graphite neutrals
lib/tubes.ts             sample type → tube cap colour (the signature detail)
lib/format.ts            paise → Rs, IST dates, financial year
```

## Rules

1. **Never build a component that a package already has.** UI is Mantine (core, dates, charts, modals,
   notifications, spotlight, nprogress), tables are mantine-datatable, forms are @mantine/form + zod,
   data is TanStack Query, icons are Phosphor (`*Icon` exports). Glue components only.
2. **Only `lib/mgpl.ts` talks to the api**, through `@mgpl-diagnostics/client`. Never import a backend kit.
   The browser calls `/graphql` on this origin; `next.config.ts` forwards it to `MGPL_API_URL`.
3. **Permissions are auth-kit's.** Hide what a role can't do (`can()` / `<Guard>`), but the api is the
   authority: every call is checked again per branch. Never send an `orgId` or `actorId`.
4. **Money is integer paise** until it is printed (`rupees()`); rupees typed by people go through `toPaise()`.
   Days and times print in IST; the financial year is April to March.
5. **Motion stays small**: one anime.js entrance per page (`<Enter>` + `data-enter`, max six blocks),
   tweened figures, and ScrollSmoother on fine pointers only. All of it is off for prefers-reduced-motion.
6. **Design** follows the unslop checklist: graphite surfaces, one saffron accent, 4px spacing, sentence
   case, no gradients, glows, emoji or exclamation marks, figures in `tabular-nums`.
7. **Responsive**: check 390 px and 1440 px. Tables hide secondary columns with `visibleMediaQuery`;
   nothing scrolls the page sideways.
8. Never commit tokens, `.env` files, patient data or real signatures. Samples are fictional.

## Commands

```bash
npm install                 # @mgpl-diagnostics/client from GitHub Packages (NODE_AUTH_TOKEN, read:packages)
npm run dev                 # http://localhost:3001, api at MGPL_API_URL (default http://localhost:4000)
npm run typecheck && npm run lint && npm run build
```

Next.js 16 differs from older versions: read `node_modules/next/dist/docs/` before using a Next API.

## Licence

All rights reserved (see LICENSE).

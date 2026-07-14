# Glossary

Internal vocabulary used throughout the spec — read this before the main document. Terms are grouped roughly by where they first matter.

## People & Roles
- **Stylist** — sources inventory for a job (Warehouse or Existing Pickup) and later performs the on-site styling visit. Two different tasks, can be the same person or different people.
- **Removalist Crew** — delivers/collects furniture. Each member has their own account (no shared logins).
- **Head Stylist/Management** — creates quotes, assigns runs, manages day-to-day operations. Slightly reduced financial visibility vs. Admin, configurable.
- **Hirer** — the business's own legal term (from their existing paperwork) for the client renting the furniture. Not used in the system's UI, but may appear in contract text.

## Quotes & Sales
- **Quote Recipient Type** — whether a quote is addressed to a `Real Estate Agent` or a `Client` directly.
- **Bill To** — separate from Quote Recipient Type: who actually gets invoiced (`Client` or `Agent`). An agent-initiated quote can still bill the client, or vice versa.
- **Lead Source** — where a client came from (Google Ads, Facebook, Instagram, other social, word of mouth, or agent referral). Required on every client.
- **Lost Reason** — why a quote didn't convert (`Quoted Too High`, `Client Went With Agent's Own Stylist`, `Other`).
- **`TBC`** — a job that's Confirmed and on the calendar, but without a fixed installation date yet (a placeholder slot).
- **Magic link** — a unique, single-use, unguessable URL emailed to a client that gives them access to one specific action (view/sign a quote, respond to an extension question) without a login.

## Job Status
- **Booked** — a quote has just been signed; provisional, nothing scheduled yet.
- **Confirmed** — the actual "win." Set automatically the moment a job gets any calendar entry (real date or `TBC`).
- **Cancelled** — a job that was Confirmed but later fell through (counted as a loss, separately from a quote-stage loss).

## Room Builder (quoting)
- **Room Template** — a pre-built, reusable list of standard furniture for a room type (e.g. "Bedroom – Master"), seeded from the business's existing paperwork (Appendix A).
- **Custom Room** — a room built from scratch on-site with no template (e.g. "Office").
- **Quote Room** — one room instance on a specific quote — either from a template or custom.

## Inventory
- **Item Type** — a catalog entry (e.g. "Queen Bed – Oak Frame") with a photo and description. Not a single physical unit — a *type* of item the business owns several of.
- **Location Ledger** — the running count of how many units of an Item Type currently sit at each location (Warehouse or a specific live job). This is what replaces barcoding.
- **Existing Pickup** — sourcing an item for a new job directly from another job that's currently being de-staged, rather than from the Warehouse.
- **Sourcing status** — `Not Sourced` / `Pending Arrival` (coming from an Existing Pickup that hasn't been collected yet) / `Sourced` (physically confirmed available) / `Needs Attention` (nothing suitable could be found).
- **Ready** — a job-level flag meaning every required item across every room is `Sourced`. Can never be true while any item is `Needs Attention`.
- **Needs Attention** — a flag raised when a Stylist genuinely can't source an item; persists as a visible badge on the job (not just a one-off notification) until resolved.

## Logistics
- **Run** — one crew's full schedule for a day: vehicle + people + jobs + what to pick up/drop at each.
- **Arrival / Departure checklist** — two short checklists per property stop (see Appendix B), distinct from the once-daily **Warehouse Departure** checklist done before a run even leaves for the day.
- **Team sign-off** — every crew member assigned to a stop must individually confirm before it's marked complete; one person ticking everything alone isn't sufficient.
- **`arrived_at` / `departed_at`** — explicit timestamps captured per stop, used for the Live Progress Dashboard and for labour cost calculations.

## Hire Lifecycle
- **Hire period** — the duration furniture is with a client, defined by `hire_start_date`/`hire_end_date` on the Job.
- **Extending week-by-week (pending)** — a distinct, open-ended extension state for a client who wants to keep the furniture without committing to a new fixed end date yet.
- **Delivery Complete photos** vs. **After/Completed photos** — the former are the Removalist Crew's handoff shots once furniture is placed but not styled; the latter are the Stylist's final, client-facing photos once actual styling is done. Different people, different purposes, different triggers.

## Financial
- **Bill To** — see above (Quotes & Sales); also exists on Job, carried through from the Quote.
- **Item Cost per Use** — an Item Type's replacement value divided by its expected useful life in uses — spreads furniture ownership cost across every job it's used on, rather than one job absorbing the full replacement cost.
- **Overhead Allocation** — an optional, later-stage addition to job costing (rent, insurance, admin salaries) — deliberately left at 0% until direct costs are proven accurate.

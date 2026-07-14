# Development Backlog — Epics & User Stories

Organized to match the build order in the main spec (Section 15). Each story includes acceptance criteria a developer can estimate and test against. This isn't exhaustive down to every field — it's enough to scope, estimate, and start sprint planning; expect to break some stories down further once work begins.

---

## Epic 0: Foundations — Roles, Auth & Data Model

**US-0.1**: As an Admin, I want to create and manage staff accounts with specific roles, so that each person only sees and does what their role allows.
- Acceptance criteria: Admin can create/edit/deactivate a Staff account; assign one role (Admin/Head Stylist/Management/Stylist/Removalist Crew); each role's permissions match Section 1 exactly; a deactivated account can't log in but its historical records remain intact.

**US-0.2**: As a Client, I want to access my quote and job information without creating an account, so that I don't need to remember a password for a one-off interaction.
- Acceptance criteria: each client-facing email contains a unique, non-guessable link; the link grants access only to the specific quote/job/action it was generated for; expired or already-used single-purpose links (e.g. a signed quote) show a clear "already completed" state rather than an error.

**US-0.3**: As a developer, I want the core entities (Client, Agent, Quote, Job, Item Type, Staff, Vehicle, Key, Photo, Checklist) built per the data model in Section 2, so that every later epic has a stable foundation.
- Acceptance criteria: all fields and relationships in Section 2 exist in the schema; the Win/Loss status logic (Booked → Confirmed automatically on calendar entry) is enforced at the data layer, not just the UI, so it can't be bypassed by a direct API call.

---

## Epic 1: Client & Quote Lifecycle (Section 3)

**US-1.1**: As Head Stylist/Management, I want to add a new client and capture their lead source, so that referral reporting is accurate from day one.
- Acceptance criteria: matches the exact flow in Section 3.1; Lead Source is required; selecting "Referred by Agent" requires an Agent selection or inline creation; client is immediately usable elsewhere in the app without a page reload.

**US-1.2**: As Head Stylist/Management, I want to choose how a quote will be created (remote vs. scheduled site visit) before entering any client details, so that the right downstream flow is used.
- Acceptance criteria: "How will this quote be created?" is the first screen in the New Quote flow, before recipient selection; choice persists and correctly routes to Section 3.3 or 3.4.

**US-1.3**: As Head Stylist/Management, I want to specify whether a quote is for an Agent or a Client, so that agent-initiated quotes can exist without a named client yet.
- Acceptance criteria: matches Section 3.2 steps 3–5 exactly; an agent-only quote can be saved and later have a client attached, at which point the client's Lead Source auto-defaults to "Referred by Agent" with this agent pre-filled.

**US-1.4**: As Head Stylist/Management, I want to schedule an in-person quote visit, so that it appears on the team calendar and the assigned person can complete an on-site inspection.
- Acceptance criteria: matches Section 3.4; creates a Calendar entry; quote status becomes `Scheduled`; the assigned person can open the quote from the Calendar and access the Room Builder (Epic 2).

**US-1.5**: As Head Stylist/Management, I want to control exactly who a quote is emailed to at send time, so that agents aren't CC'd without an explicit decision.
- Acceptance criteria: matches Section 3.2 step 7; the "Also send a copy to [Agent]?" toggle defaults to No; the final recipient list is shown and editable immediately before the send is confirmed; the decision is stored (`cc_agent_on_send`) against the quote.

**US-1.6**: As Head Stylist/Management, I want to mark a quote as lost with a reason, so that loss patterns are visible in reporting.
- Acceptance criteria: matches Section 3.5; reason is required; quote status becomes `Declined`; feeds the win/loss dashboard breakdown (Epic 6).

**US-1.7**: As Head Stylist/Management, I want to convert a signed quote into a scheduled job, either with a real date or as a placeholder, so that a slot is reserved even before an exact date is confirmed.
- Acceptance criteria: matches Section 3.6; setting a real date creates a dated Calendar entry and moves status toward `Install Scheduled`; marking `TBC` creates a placeholder Calendar entry; either action sets Job status to `Confirmed` automatically per the Win/Loss rule in Section 2.

---

## Epic 2: On-Site Quote Builder (Section 4)

**US-2.1**: As a quoting user, I want to add a room from a list of standard templates and have its typical furniture pre-fill automatically, so that I'm not typing every line item from scratch.
- Acceptance criteria: tile-based room selector (not a dropdown); selecting a standard type pre-fills items per Appendix A; every pre-filled field (size, quantity, on/off toggle) is editable inline.

**US-2.2**: As a quoting user, I want to add a completely custom room with no template, so that anything outside standard inclusions (e.g. an office) can still be quoted.
- Acceptance criteria: `+ Custom Room` tile is present alongside standard ones; a custom room behaves identically to a standard one once created (rename, duplicate, add items) — no functional difference.

**US-2.3**: As a quoting user, I want to add photos and notes to a room during an on-site visit, so that the Stylist assembling the job later has real context, not just a text list.
- Acceptance criteria: multiple photos and free-text notes can be attached per room; both carry through to the Job once the quote converts (Epic 3).

**US-2.4**: As a quoting user, I want the quote's price to work as a single flat number I enter manually (not derived from item pricing), so that quoting matches current business practice.
- Acceptance criteria: implements Option A from Section 4's pricing note; confirm with the business before switching to per-item pricing (Option B) — see the open-questions log.

---

## Epic 3: Inventory & Job Assembly (Section 5)

**US-3.1**: As a Stylist, I want a job's room list to carry over automatically from its quote, so that I'm not rebuilding the furniture list from scratch.
- Acceptance criteria: converting a quote to a job (Epic 1) copies every Quote Room and Quote Line Item across as the Job's "to be sourced" list, including photos/notes.

**US-3.2**: As a Stylist, I want to source each required item from either Warehouse stock or another job that's currently de-staging, so that I can fulfil a job using either supply source.
- Acceptance criteria: matches Section 5 steps 1–4; Warehouse selections mark `Sourced` immediately; Existing Pickup selections mark `Pending Arrival` until the source job's De-install Departure checklist is signed off, then flip automatically.

**US-3.3**: As a Stylist, I want the system to stop me from over-committing stock that isn't actually available, so that two jobs never rely on the same physical item.
- Acceptance criteria: matches Section 5 step 5; blocks a selection when requested quantity exceeds free quantity for the relevant hire dates; distinguishes a hard conflict (against a Confirmed job) from a soft one (against a pending quote).

**US-3.4**: As a Stylist, I want to flag an item I genuinely can't source, so that Management knows and can help resolve it rather than the job silently shipping incomplete.
- Acceptance criteria: matches Section 5 step 6 and the "Handling a Needs Attention flag" behaviour — immediate notification, persistent visible badge on the job/job list/calendar, a company-wide list of all open flags, and a recorded resolution (who/when/how) once cleared. A job can never show as `Ready` while any item is `Needs Attention`.

**US-3.5**: As a Stylist, I want a fast, drag-and-drop-capable workstation for sourcing, so that assembling a job takes minutes, not tens of minutes.
- Acceptance criteria: drag-and-drop on tablet/desktop with an equivalent tap-to-add on phone; live job summary panel; type-ahead search; "copy this room's sourcing" to another room; one-tap undo. (This story is UX-heavy — expect it to be split into several smaller tickets during sprint planning.)

---

## Epic 4: Delivery, Styling & Client Completion (Section 6)

**US-4.1**: As a Removalist Crew member, I want to mark delivery complete and upload handoff photos, so that the assigned Stylist knows to come and style the property.
- Acceptance criteria: completing the Install Departure checklist (Epic 5) with team sign-off sets the job to "delivered, not yet styled"; Delivery Complete photos are attached; the assigned Stylist receives an immediate notification.

**US-4.2**: As a Stylist, I want to mark styling complete and upload final photos, so that the client is notified with the real, finished result.
- Acceptance criteria: "Mark Styling Complete" requires at least one After/Completed photo; this action — and only this action — triggers the client completion email (Epic 8); Job status moves to `Styled/Live`.

---

## Epic 5: Checklists & Daily Runs (Section 7, Appendix B)

**US-5.1**: As Head Stylist/Management, I want to see tomorrow's installs and pickups at a glance, with problems visibly flagged, so that I can catch issues before the day of.
- Acceptance criteria: matches Section 7's Logistics Dashboard; defaults to tomorrow; each job card shows inventory readiness and key/access status; anything red is visually obvious without opening the job.

**US-5.2**: As Head Stylist/Management, I want to assign a vehicle, crew, and stylist to a job the day before, so that everyone knows their schedule in advance.
- Acceptance criteria: matches Section 7's assignment flow; multiple jobs can be grouped into one crew's run; saving notifies every assigned Staff member with their own schedule view.

**US-5.3**: As a Removalist Crew member, I want a Warehouse Departure checklist before I leave for the day, so that nothing is forgotten before the run starts.
- Acceptance criteria: matches Appendix B's Warehouse Departure list exactly; requires whole-crew sign-off before the run can be marked departed.

**US-5.4**: As a Removalist Crew member, I want Arrival and Departure checklists at every property stop, so that nothing is missed on-site and damage is caught immediately.
- Acceptance criteria: matches Appendix B's Install and De-install checklists; damage photo capture is a required step in both Departure checklists; `arrived_at`/`departed_at` are set automatically per Section 2; whole-crew sign-off required before a stop is marked complete; a Job cannot reach `Completed` status until all its checklists are signed off.

**US-5.5**: As Admin/Management, I want to watch the current day's runs in real time, so that I know if a crew is running late without having to call them.
- Acceptance criteria: matches Section 7's Live Progress Dashboard; grouped by run; shows per-stop status and live checklist completion count; surfaces a running-late warning based on expected vs. actual timing; updates without a manual refresh.

---

## Epic 6: Calendar & Dashboards (Sections 8, 9, 10)

**US-6.1**: As any staff user, I want a shared calendar showing quotes, site visits, jobs, and TBC placeholders, so that the whole team sees the same schedule.
- Acceptance criteria: matches Section 8; color-coded by type/status; filterable by crew/stylist/vehicle; clicking an entry opens the full job record.

**US-6.2**: As Admin, I want a dashboard showing financial summary, pipeline, and win/loss (with reasons), so that I can see business performance at a glance.
- Acceptance criteria: matches Section 9; win = automatic `Confirmed` status; loss is split into quote-stage vs. booking-stage categories; quote-stage losses break down by Lost Reason; filterable by date range and team member.

**US-6.3**: As Management, I want a dedicated view of every job by how soon its hire ends, with quick actions to extend or mark a property sold, so that I'm not relying on emails alone to manage this.
- Acceptance criteria: matches Section 10 exactly, including the two extension types (fixed new date vs. week-to-week pending) and the "Mark as Sold" quick action that prompts scheduling a pickup.

---

## Epic 7: Client Communications (Section 11)

**US-7.1**: As a Client, I want to receive clear, complete emails at every major stage of my job, so that I always know what's happening without having to ask.
- Acceptance criteria: all six triggers in Section 11 are implemented exactly as specified, in the correct order; every email includes full relevant details (address, date/time, contact) rather than a bare link; any update not covered by a named trigger still sends a generic fresh update email.

---

## Epic 8: Integrations (Section 12)

**US-8.1**: As Admin, I want signed quotes and completed jobs to generate invoices in Xero automatically, so that financial data doesn't need manual re-entry.
- Acceptance criteria: Bill To (Client or Agent) determines the invoice recipient; invoicing is fully decoupled from Job status — it can happen at any point and doesn't gate Confirmed/win logic.

---

## Epic 9: Job Profitability (Section 13)

**US-9.1**: As Admin, I want to see actual profit margin per completed job, so that I know which jobs, packages, and agents are genuinely profitable.
- Acceptance criteria: implements the full cost/revenue calculation in Section 13.2–13.5; built on **Actual** figures first (real logged hours, real allocated inventory, real damage costs); visible to Admin/Management only, never to Stylists or Removalist Crew.

**US-9.2**: As Admin, I want profitability rolled up by package, agent, and crew, so that I can spot patterns rather than reviewing jobs one by one.
- Acceptance criteria: matches Section 13.7's rollups; flags jobs below a configurable margin threshold.

---

## Epic 10+: Roadmap (Section 14)

Lower priority — pull individual items into a sprint once Epics 0–9 are stable. Each bullet in Section 14 of the main spec can become its own story when scheduled; no need to write them out in advance.

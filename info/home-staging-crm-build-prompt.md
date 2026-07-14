# Home Staging CRM — Master Build Prompt

> Paste this document into your AI app builder (Base44, Zite, Lovable, etc.) as the starting prompt. If the tool limits prompt length, paste it section by section in the order below, building and reviewing after each one rather than all at once.
>
> **If you're a developer receiving this as a handoff document rather than pasting it into a no-code tool**: see the companion files — Glossary, ERD, Backlog, and Open Questions — for the pieces this document alone doesn't cover.

---

## Goals & Context

This is a home staging business: they furnish vacant properties (mostly for real estate agents preparing a listing) with rented furniture and decor for a fixed or extendable hire period, then de-install once the property sells or the hire ends. Most new business comes through agent referrals, so agent tracking and relationship reporting matter throughout.

The business currently runs this manually — quotes on paper/email, inventory tracked by memory and photos, no system connecting a quote to the furniture that actually gets delivered. This build replaces that with a single system covering the full lifecycle: quote → book → source inventory → deliver → style → manage the hire → de-install → report on profitability. The goal is a system that's fast enough for staff to actually use in the field (mobile-first, minimal typing, drag-and-drop where practical), not just a back-office database.

---

## 0. Project Summary

Build a web-based CRM/operations system for a home staging company. The business quotes clients (often via real estate agents who refer most of the work), delivers furniture/decor to properties for a fixed or extendable hire period, manages the removalist crews who install and de-install stock, tracks inventory across a warehouse and active jobs, manages keys to properties, and needs full financial and pipeline visibility for management.

Five user types: **Admin**, **Head Stylist/Management**, **Stylist**, **Removalist Crew**, and **Client** (portal-only access, no full system visibility).

Build this as a real multi-user web app with logins, roles, and a shared database — not a static site. Stylist and Removalist Crew views must be mobile-first, since both roles work on-site from phones/tablets, not at a desk.

---

## 1. User Roles & Permissions

**Admin**
- Full visibility into everything: all jobs, quotes, financials, inventory, team performance.
- Dashboard (Section 9) with financial summary, sales pipeline, and win/loss stats.
- Manages users, roles, vehicles, and system settings.

**Head Stylist / Management**
- Creates and sends quotes to clients and agents.
- Changes job status (Booked → Confirmed → Install Scheduled → In Progress → Styled/Live → De-install Scheduled → Completed/Extended/Ended, or Cancelled — see Section 2).
- Updates job information (client, agent, address, dates, keys, photos).
- Assigns Stylists, Removalist Crews, vehicles, and runs (Section 7).
- Views the Calendar, Inventory, and reports — may have slightly reduced financial visibility vs. Admin (configurable permission).

**Stylist**
- Views jobs assigned to them.
- **Sources each room's required items** from Warehouse stock or an existing pickup (a job currently being de-staged) — Section 5.
- **Conducts the on-site styling visit** once assigned and notified that delivery is complete — styles the property, taps "Mark Styling Complete," and uploads the After/Completed photos, which trigger the client completion email (Section 6/11).

**Removalist Crew**
- Each crew member has their own individual account (Staff entity, Section 2) — no shared logins.
- Each day, automatically receives their own run: which jobs, what to pick up/drop off, which vehicle, which address, and an Arrival/Departure checklist per stop (Section 7).
- Ticks off checklist items on arrival and before leaving each property, timestamped and attributed to them — photographing and logging any damage on the spot, and giving a whole-crew sign-off before a stop is marked complete.
- Uploads key handover photos and job photos directly from the run view.
- Can see, per job on their run: property address, install/photo times, key location, and contact details for both the agent and the client. **Cannot** see pricing, costs, margins, or any financial figures (Admin/Management-only — Section 13.8).

**Client** (portal access only, single-use per email — no persistent login)
- No traditional login/password. Access is via a secure, unique magic link emailed at each relevant step — clicking it takes the client straight to the relevant action, no account needed. Each link is tied to that specific quote/client and not guessable.
- Via the magic link: views the quote, enters their details, and signs directly in the portal (typed name or drawn signature, timestamped) to accept terms & conditions.
- Receives ongoing automated updates by email as the job progresses (Section 11) — booking confirmation, reminders, completion photos, hire-ending decisions.
- Cannot see internal data, other clients, or financials.

---

## 2. Core Data Model

Build these as connected entities (adjust field names to fit the tool, but keep the relationships).

**Clients**
- Name, primary phone/email, property address, notes.
- Secondary email(s) — repeatable, so quotes/updates can also be sent to another address (e.g. a partner, or one the referring agent asks to be included).
- Lead Source (required, single-select): `Google Advertising`, `Facebook Lead`, `Instagram Lead`, `Other Social Media`, `Previous Customer / Word of Mouth`, `Referred by Agent`.
- Referring Agent (conditional): required and shown only when Lead Source = `Referred by Agent`. Links to an existing Agent, or add one inline without leaving the screen (Section 3.1).

**Agents**
- Name, agency, contact info (phone/email).
- Linked to every Client they've referred, every Quote made out to them directly, and every Job — since most of the business's clients come through agents, this is a core reporting entity (Sections 14.2 and 13.7).

**Quotes**
- Quote Recipient Type (required, first question when creating a quote): `Real Estate Agent` or `Client` (Section 3.2).
- Linked to either an Agent or a Client — optionally both, since an agent-initiated quote will usually name the actual client once known.
- Created by Head Stylist/Management. Line items (furniture/decor packages, styling fee, delivery, etc.), total price.
- Status: `Draft` → `Scheduled` (site visit booked, Section 3.4) → `Sent` → `Viewed` → `Signed`/`Accepted` → `Declined` → `Expired`.
- Terms & conditions signature field + timestamp.
- `cc_agent_on_send` (Yes/No, defaults No) — whether the linked agent was CC'd when the quote was sent (Section 3.2).
- Bill To (required, single-select): `Client` or `Agent` — set here, carried through to the Job once signed.
- Lost Reason (single-select, shown only when marked lost — Section 3.5): `Quoted Too High`, `Client Went With Agent's Own Stylist`, `Other` (free text).
- On `Signed`, auto-converts to a Job.

**Jobs**
- Linked to: Client, Agent, Quote, assigned Stylist(s), assigned Removalist Crew, assigned Vehicle(s).
- Bill To (required, single-select): `Client` or `Agent` — determines who receives the invoice. **Invoicing is a fully separate, manual/Xero-driven process** and doesn't gate or get gated by Job status — a job can be Confirmed and won well before an invoice is ever raised.
- Status: `Booked` (auto-created the moment a Quote is Signed — provisional, nothing on the calendar yet) → `Confirmed` (set automatically the instant the Job gets any calendar entry — a real Installation Date or a `TBC` placeholder — since either means it's locked into the schedule; this is the actual win, no manual step) → `Install Scheduled` (once a real date replaces `TBC`) → `In Progress` → `Styled/Live` → `De-install Scheduled` → `Completed` → `Extended` → `Ended`, or `Cancelled` (fell through after being Confirmed).
- Installation Date: nullable. Set via the "Convert to Job" flow (Section 3.6) as either a real date/time or a `TBC` placeholder.
- Assigned Stylist for the on-site styling visit (can be the same person who sourced inventory, or different) and Styling Visit Date/Time — settable independently of the Installation Date, assigned the day before via the Logistics Dashboard (Section 7).
- Fields: property address, install date/time, photo shoot date/time, hire start/end date, key location/holder, agent contact, client contact, notes.
- Linked checklist(s), photos, and inventory allocation.

**Win/Loss definition** (drives Section 9's dashboard)
- A **Win** is counted automatically the moment a Job reaches `Confirmed` — i.e. the instant it's booked into the calendar, real date or `TBC`. No manual sign-off.
- A **Loss** happens two ways, kept distinguishable in reporting: (1) a Quote Declined/Expired — never became a job, or (2) a Job Cancelled after being Confirmed — booked in, then fell through.

**Inventory — Item Types & Location Ledger**

Since stock isn't individually coded or serialized, don't track "this exact unit" — track it the way the business already thinks about it (photo + description), with structure underneath:
- **Item Type** (catalog entry): name (e.g. "Queen Bed – Oak Frame"), category, room tags, style tags, photo(s), condition notes, total quantity owned company-wide. This is what Stylists browse and pick from (Section 5).
- **Location Ledger** (per Item Type): how many units currently sit at each location — Warehouse or a specific live Job (e.g. "8 total → 5 Warehouse, 2 at 21 Amcury St, 1 at 14 Bourke Rd"). Updates every time an item moves. This is what gives real-time availability without a barcode.
- **History log**: which jobs an Item Type's units have moved through — feeds wear/depreciation tracking (Section 13) and flags items getting overused relative to how many are owned.

If the catalog later grows large enough that visually similar items get hard to tell apart, a simple printed tag or QR code per physical unit is the natural next step — not a day-one requirement.

**Staff**
- Individual account per team member — name, phone, email, role, login credentials. Every Removalist Crew member has their own account, not a shared login.
- Optional availability/roster field, so Management isn't assigning someone already on leave or booked elsewhere (Section 14.5).

**Checklists**

Reusable templates, each split into an Arrival and Departure half per stop, kept deliberately short so crews actually complete them. Five default templates to seed (Install Arrival/Departure, De-install Arrival/Departure, and a once-per-day Warehouse Departure) — see **Appendix B** for the full default content.

- Any crew member can tick individual items as they go (timestamped, attributed to them), but a checklist can't be cleared on one person's tick alone — every crew member on that stop/run must confirm before it's marked complete.
- A Job can't move to `Completed` until the relevant checklist(s) are fully ticked *and* signed off by the full crew.
- Two explicit fields per stop, not just implicit checklist timestamps: `arrived_at` (set when the Arrival checklist starts) and `departed_at` (set when the Departure sign-off completes) — these power the Live Progress Dashboard (Section 7) and feed labour cost (Section 13.2).

**Keys**
- Linked to a Job. Fields: current holder, status (`With Agent`/`Picked Up`/`With Crew`/`Dropped Off`/`Returned`), pickup/drop-off date and photo.
- Anyone handling keys can update status and upload a photo at pickup/drop-off — a simple audit trail of where keys are at any time.

**Vehicles**
- Name/rego, capacity notes, assigned to a job/run alongside a crew.

**Teams/Runs**
- A "run" = a day's schedule for a crew: vehicle + people (Staff) + jobs + what to pick up/drop at each + checklist per stop.
- Candidate jobs for a day auto-populate (any job with an install or pickup/de-install date that day), but the actual vehicle/crew/stylist assignment is a manual step from the Logistics Dashboard (Section 7), one day ahead by default.

**Photos**
- Attach to a Job, tagged by type: `Damage`, `Before` (auto-populated from the linked Quote's room photos where they exist — Section 4/5), `Delivery Complete` (Removalist Crew's handoff photos once furniture is placed but not yet styled), `After/Completed` (the Stylist's final, client-facing photos), `Key Handover`.
- Viewable by Admin/Management on the job record; `After/Completed` shared with the client automatically.

---

## 3. Client & Quote Lifecycle

### 3.1 New Client Flow

Works identically whether triggered from the Clients tab directly, or inline mid-quote (Section 3.2) — same form either way.

1. Click **"Add New Client."**
2. Form fields: Name, phone, primary email, property address, notes.
3. **"How did this lead come to us?"** — single-select per the Lead Source list in Section 2.
4. If `Referred by Agent`: a **"Which agent?"** field appears — searchable dropdown of existing Agents, plus **"+ Add New Agent"** (inline form: name, agency, phone, email) without leaving the client form.
5. Optional **"+ Add secondary email."**
6. Save → client is created and immediately available for selection anywhere in the system, including back in whatever quote/job screen triggered this.

### 3.2 New Quote Flow

Triggered by the "New Quote" button/icon, wherever it appears.

1. Click **"New Quote."**
2. **First question, before any client details: "How will this quote be created?"**
   - `Send from Floorplan/Online Photos` — a remote quote, priced without a physical visit.
   - `Schedule a Quote Day` — book an in-person visit before pricing it.
3. **Second question: "Who is this quote for?"** — `Real Estate Agent` or `Client`.
4. If **Real Estate Agent**: searchable dropdown of existing Agents, plus **"+ Add New Agent"** inline. The quote links to that Agent; the actual client can be attached later once known (their Lead Source then auto-defaults to `Referred by Agent` with this agent pre-filled).
5. If **Client**: **"Select Existing Client"** or **"Add New Client"** (launches Section 3.1 inline, without leaving the quote screen).
6. From here the path splits based on the Quote Type chosen in step 2 — see Sections 3.3 and 3.4.
7. **At send time**, show the full recipient list before anything goes out: the Client's primary + secondary emails, plus an editable toggle — **"Also send a copy to [Agent Name]?"** (defaults No) — shown whenever an agent is linked. Recipient list stays visible and editable right up to confirming send.

### 3.3 Path A: Send from Floorplan/Online Photos

1. Skip straight to the quote builder — no visit required.
2. Enter a fixed price for the job (see the pricing note in Section 4).
3. Select a hire duration: `6 Weeks`, `8 Weeks`, or `Custom`.
4. Optional: still add rooms/items using the Room Builder (Section 4) off the floorplan/photos, purely to generate the internal furniture list — doesn't have to drive the price.
5. **Optional escalation**: a "Schedule Site Visit" button is available at any point, dropping into the same flow as Section 3.4 without starting a new quote.
6. Send (Section 3.2, step 7).

### 3.4 Path B: Schedule a Quote Day

1. Date picker (pulling from the Calendar, Section 8) — select the visit day.
2. Visit details: time, and visit type — `Viewing with Client` or `Keysafe Access`.
3. Assign a team member to conduct the visit.
4. Save → creates a Calendar entry and moves the quote to `Scheduled`.
5. On the day, the assigned team member completes the on-site inspection using the Room Builder (Section 4) — adding rooms, editing items, uploading photos and notes per room.
6. Once done, enter the fixed price and hire duration (as in 3.3, steps 2–3).
7. Status moves from `Scheduled` back to ready-to-send, and sends as normal.

### 3.5 Marking a Quote as Lost

Available from the quote's page any time before it's signed.

1. Click **"Mark as Lost."**
2. **"Why was this lost?"** — `Quoted Too High` / `Client Went With Agent's Own Stylist` / `Other` (free text).
3. Save → status becomes `Declined`, reason stored as `lost_reason`.
4. Feeds the Admin Dashboard's win/loss reporting (Section 9) with a breakdown by reason, not just a raw count.

### 3.6 Converting a Quote to a Job

A Signed quote auto-creates a Job in `Booked` status, but it may not have an install date yet — this is what schedules it.

1. From the quote/job page, click **"Convert to Job"** (or "Schedule Installation" if already Booked).
2. Two options:
   - **Set an installation date** — moves status toward `Install Scheduled` and creates a dated Calendar entry.
   - **Mark as TBC** — creates a placeholder Calendar entry (e.g. "TBC — [Client/Address]") without a fixed day; re-run this flow later once a real date is known.
3. Either way, the Job then appears on the Calendar (Section 8), can have Stylists/Crews/Vehicles assigned (Section 7), and feeds into daily run generation once the date arrives.

---

## 4. On-Site Quote Builder — Room-Based Furniture Population

Lets someone stand inside a property on a phone or tablet, build a quote room by room, with the standard furniture list populating automatically. Used both for the on-site inspection (Section 3.4) and, optionally, for the internal furniture list on a remote quote (Section 3.3).

**Data model**
- **Room Templates** (admin-configurable, seeded from Appendix A): a template name plus default line items, each with an item name, editable attribute (e.g. bed size), default quantity, and optionally a default unit price.
- **Quote Rooms**: an instance of a room on a specific quote. Room type (a Template, or `Custom` for one built from scratch), a renameable label, its line items, one or more photos (from an on-site inspection), and a notes field. Custom rooms start empty.
- **Quote Line Item**: item name, attribute, quantity, unit price (if used), which room it belongs to, and whether it came from a template or was added manually.

**Flow**

1. Tap **"+ Add Room."**
2. Choose from a tile list (tappable on a phone, not a tiny dropdown): `Hallway/Entry`, `Bedroom – Master`, `Bedroom – Standard`, `Bedroom – Single/Study`, `Living Room – Front`, `Living Room – Main`, `Kitchen & Meals`, `Bathroom & Laundry`, `Outdoor Setting`, plus a **`+ Custom Room`** tile.
   - **Custom Room**: type any room name (e.g. "Office," "Rumpus Room") and add items from scratch — no template. Works identically to a standard room once added (renaming, duplicating, toggling items, ad-hoc additions) — the only difference is whether it started pre-filled or empty.
   - **"Save as Template"** (optional): lets a frequently-used custom room become a real Room Template after its first use.
3. Selecting a standard room instantly pre-fills its items (e.g. "Bedroom – Standard" adds a Bed with a Single/Double/Queen/King dropdown, 2x Bedside Tables & Lamps with a quantity stepper, an Occasional Chair toggle, and a decor bundle line).
4. Every field is editable inline — dropdowns, quantity steppers, remove toggles, and freely editable item names/text.
5. **"+ Add Item"** per room for anything outside the standard list — free-text name, quantity, price.
6. Rooms can be renamed and duplicated (handy for near-identical bedrooms).
7. If unit pricing is used (see below), the quote total updates live as items change.
8. Mobile-first: large tap targets, dropdowns/steppers/toggles over free-text wherever possible, usable one-handed while walking through a property.

**Pricing note**: the business currently quotes a single flat total per job, not per item. Two options — start with **Option A**: room/item selection only builds the internal furniture list (inventory allocation, packing, checklist); the quote price stays a single flat number entered manually. Move to **Option B** later if wanted: price every item and let the system total the quote automatically as rooms/items change — more setup, but scales better with volume.

See **Appendix A** for the default room templates, seeded from the business's existing Authority to Furnish document.

---

## 5. Job Assembly — Stylist Inventory Sourcing Flow

Turns a quote's room-by-room furniture list into a real, sourced job — matching "this room needs a Queen Bed" to an actual unit, whether from the Warehouse or another job that's de-staging. Both sourcing methods run through the same screen.

**Continuity from the quote**: when a Quote's rooms/items (Section 4) convert to a Job (Section 3.6), that list carries straight over as the Job's "to be sourced" list — the Stylist isn't starting from a blank page. Room photos and notes from the quote stage carry over too, shown side-by-side with the item list, and also become the Job's `Before` photos automatically (Section 2).

**Flow**

1. Stylist opens the job, taps **"Put Together Job."** Each room shows its required items with a status: `Not Sourced` / `Pending Arrival` / `Sourced` / `Needs Attention`.
2. Tapping an unsourced item opens a sourcing picker with two tabs:
   - **Warehouse** — browse/search current stock by category/room/style tag, with photo and live available quantity. Selecting assigns it and moves the Location Ledger quantity to "reserved for this job."
   - **Existing Pickup** — browse other jobs scheduled to de-install on or before this job's install date, filtered to matching item types, showing the source address and de-install date. Selecting assigns it as a direct job-to-job transfer.
3. Warehouse selections are marked `Sourced` immediately. Existing Pickup selections are marked `Pending Arrival` until the source job's De-install Departure checklist (Appendix B) is actually signed off — then it flips to `Sourced` automatically.
4. If an item isn't in the catalog at all, quick-add it as a new Item Type on the spot (name, photo, category) — a real catalog entry for next time, not a one-off note.
5. **Availability check, not just display**: before confirming a selection, verify the Item Type has enough free quantity for this job's hire dates. Block over-commitment and show what's actually free. Distinguish a hard conflict (competing reservation against a Confirmed job) from a soft one (against a quote still pending signature).
6. **If nothing suitable can be found**, tap **"Can't Source This"** — reason (`No Stock Available` / `Wrong Size` / `Damaged` / `Other`) — which sets the item to `Needs Attention` (see below).
7. Once every item in every room is `Sourced`, the job's inventory is marked **Ready**. A job with any `Needs Attention` item can never show as Ready.

**Handling a `Needs Attention` flag**
- Immediate internal notification to Head Stylist/Management/Admin the moment it's raised.
- A persistent, visible badge on the job record, job list, and calendar entry (e.g. "⚠ 2 items need attention") — so any Stylist or Manager opening the job later, not just whoever flagged it, sees it's incomplete and why.
- A company-wide "Needs Attention" view for Admin/Management listing every flagged item across all active jobs.
- Resolved by actually sourcing the item, quick-adding a replacement, or manually marking it resolved with a note — store who resolved it, when, and the original reason (useful for spotting patterns, e.g. a recurring stock shortage on one Item Type).

**Making this a genuine workstation, not just a form**
- Drag-and-drop on tablet/desktop, with an identical tap-to-add fallback on phone.
- A live job summary panel, always visible, listing everything sourced so far with its source tag.
- Type-ahead search across both Warehouse and Existing Pickup tabs.
- "Copy this room's sourcing" to another room in one tap (for near-identical bedrooms).
- "Recently used"/"frequently sourced" quick-pick shortcuts.
- Smart filtering toward the job's existing style/room tags as items are chosen.
- Real-time conflict warning if two stylists both reach for the same last unit.
- Simple one-tap undo on a mis-picked item.
- Ability to assign specific rooms to specific stylists on larger jobs, so more than one person can source in parallel.

This entire model runs on Item Types and quantities (photo + description), matching how the business already operates — no barcoding needed to get this running. A simple QR tag per physical unit is a reasonable future upgrade if the catalog grows large enough that visually similar items become hard to tell apart, but it's not a day-one requirement.

---

## 6. Delivery → Styling → Client Completion Email

The handoff between the Removalist Crew finishing delivery and the Stylist actually styling the property — two separate steps, two separate triggers.

1. **Removalist Crew finishes delivery**: once the Install Departure checklist (Appendix B) is fully ticked and team-signed-off, the job is "delivered, not yet styled," and the crew's Delivery Complete photos are attached — handoff photos for the Stylist, not the final client-facing ones.
2. **The assigned Stylist is notified** the moment delivery is marked complete ("Ready to Style: [Job/Address]").
3. **Stylist completes the on-site styling**, then taps **"Mark Styling Complete"** and uploads the After/Completed photos — the real, finished, client-facing shots.
4. **This action is the actual trigger** for the "Job styled/completed" client email (Section 11) — not the removalist's delivery. The email pulls the After/Completed photos directly.
5. Job status moves to `Styled/Live`.

**Assigning the Stylist ahead of time**: happens the day before, from the same Logistics Dashboard used for Vehicles/Crews (Section 7) — a separate field from the crew assignment, since it's a different person doing a different task. The styling visit can be same-day-as-delivery or the next day.

---

## 7. Daily Logistics Dashboard & Run Assignment

The day-to-day operational hub — checking tomorrow's workload, spotting problems early, and locking in vehicles, crews, and stylists.

**The dashboard**

1. Defaults to **tomorrow**, with a date picker to look further ahead/back.
2. Two grouped lists for the selected day: **Installs** and **Pickups/De-installs** — including pickups that only exist to feed another job's stock (Section 5's Existing Pickup transfers), not just full end-of-hire de-installs.
3. Each entry is a fast-glance card: address, time, and two status indicators — inventory readiness (`Ready`/`Needs Attention`) and property access status (from Keys). Anything red should stand out immediately without opening the job.
4. Clicking a card opens the full job record if needed, but the dashboard itself should answer "what's happening tomorrow, and is anything wrong" without that click.

**Assigning a vehicle, crew, and stylist**

1. From a job card (or several at once, for a crew doing multiple stops), tap **"Assign Run."**
2. Select a Vehicle and one or more Removalist Crew members (individual Staff accounts).
3. Multiple jobs can be grouped under the same vehicle/crew for the day, in a sensible stop order (Section 14.4) — this becomes that crew's Run.
4. Also assign a Stylist for each job's styling visit (Section 6) — a separate field, same day-before timing.
5. Saving finalizes the Run and immediately notifies every assigned Staff member, landing them in their own schedule view.

**What each Removalist Crew member sees**
- Their own day's schedule: job(s), order, pickup/drop items, vehicle, access info.
- The day starts at the Warehouse with its own checklist (Appendix B) before departure — everything loaded, keys accounted for, tools on the truck, any lingering `Needs Attention` flags resolved or escalated.
- An Arrival and Departure checklist per stop (Appendix B), team-signed-off before each stop is marked complete, with damage photographed and logged on the spot.

**Live Progress Dashboard** (same day — a separate view from the planning dashboard above)

1. Grouped by Run, each showing its stops in order.
2. Each stop shows `Not Started`/`Arrived`/`Departed`, driven by the `arrived_at`/`departed_at` fields (Section 2), plus a live checklist completion count.
3. A simple per-run progress indicator ("2 of 4 stops complete").
4. **Running-late flag** if a stop's expected time has passed with no arrival, or a crew has stayed well beyond a typical duration with no departure.
5. Any `Needs Attention` flag raised mid-day surfaces here immediately against the relevant run.
6. Updates live — a screen left open in the background, not one that needs refreshing.

---

## 8. Calendar

- A shared calendar visible to the whole team showing quotes, scheduled quote site visits (Section 3.4 — with assigned team member and visit type), confirmed jobs (installs, photo shoots, de-installs), and `TBC` placeholder entries (Section 3.6) for jobs booked but without a fixed date yet.
- Color-coded by type/status, filterable by crew, stylist, or vehicle.
- Clicking an entry opens the full job record.

---

## 9. Admin Dashboard

Build a dashboard (Admin, and optionally a reduced version for Management) showing:
- **Financial summary**: revenue booked, revenue this month/quarter, outstanding invoices (once Xero is connected — Section 12).
- **Sales pipeline**: quotes by stage, total pipeline value.
- **Leads in pipeline**: count and value of active, not-yet-signed quotes.
- **Win/loss**: a win = a Job automatically reaching `Confirmed` (Section 2 — no manual step). A loss = either a Quote Declined/Expired (lost at quote stage) or a Job Cancelled after Confirmed (lost at booking stage) — shown as two distinguishable categories. Quote-stage losses also break down by Lost Reason (Section 3.5).
- **Leads by source**: breakdown by Lead Source, with a sub-breakdown by individual agent (full version in Section 14.2's Agent Leaderboard).
- Filterable by date range and team member.

---

## 10. End of Hire Tracker

A dedicated tab, not just the automated client emails (Section 11) — showing every active Job sorted by how soon its hire period ends. This is what Management works from day to day.

**The view**
- Every active Job, sorted by hire end date, soonest first. Highlight anything ending within 2 weeks/1 week, matching the client email triggers.
- Each row: client, address, current hire end date, quick status ("Ending — awaiting decision," "Extending week-to-week," "Sold — pickup pending").

**Handling an extension**
- **Set a new fixed end date** — updates the hire end date and reschedules the de-installation reminder against it.
- **Mark as "Extending Week-by-Week (Pending)"** — a distinct, visibly flagged state for a client who wants to keep going without a fixed new date. Resurfaces on this tab each week for a quick re-check rather than being treated as resolved.
- **Either way, re-run the availability check from Section 5** against anything sourcing stock from this job as an Existing Pickup — extending a hire can strand another job expecting that stock back on the original date. Flag it here, not as a surprise on someone else's install day.

**Marking a property as sold**
1. **"Mark as Sold"** records the sale (flag + date) on the Job.
2. Immediately prompts to schedule the pickup/de-install (reusing Section 3.6's date-picker flow, for a de-install date).
3. Visibly flags the job as "Sold — Pickup Pending" on this tab and the Calendar.

---

## 11. Client Communications & Automation

Automated triggers, in the order they happen across a job's life:

1. **Quote sent** → magic-link email (no login) to view the quote, enter details, and sign directly in the portal.
2. **Booking confirmed** → the moment a signed quote gets a real Installation Date (not `TBC`). Confirms property address, install date/time window, hire period, and what to expect. A lighter "we've received your agreement, confirming your install date shortly" version if the job is `TBC`, followed by the full confirmation once a real date is set.
3. **Installation reminder** → a configurable number of days before the Installation Date (default 2), restating date/time/address/access.
4. **Job styled/completed** → triggered specifically by the Stylist's "Mark Styling Complete" action (Section 6), not by delivery. Sends the After/Completed photos directly.
5. **Hire period ending** → 2 weeks and 1 week before hire end date, asking whether the client wants to extend or end — with a simple way to respond that updates the job.
6. **De-installation reminder** → a configurable number of days (default 2) before the actual confirmed pickup date, whatever that currently is (original or extended).

**General rule**: every client email carries the complete relevant details for that stage — address, date/time, contact point — not a bare link with nothing else.

**No persistent client portal, by design**: access stays single-use per email rather than a reusable always-on portal. Any meaningful update not already covered above (a date change, a confirmed extension, a property marked sold) should trigger a fresh update email with current information — the client stays current through new emails, not a dashboard they have to remember to check.

---

## 12. Integrations

- **Xero**: connect for invoicing/financials so the Admin Dashboard's financial numbers reflect real accounting data, and signed quotes/completed jobs can generate invoices without manual re-entry. Invoicing runs independently of Job status (Section 2) — it's a separate, manual/Xero-driven process.

---

## 13. Job Profitability — Calculation Logic

The piece that shows which jobs, packages, and agents are actually making money — not just which bring in revenue.

### 13.1 Extra fields needed

- **Staff**: `hourly_rate` (Admin-only visibility).
- **Vehicle**: `day_rate` (flat cost per day of use — fuel, maintenance, insurance, amortized purchase cost).
- **Inventory Item Type**: `replacement_value`, `useful_life_uses` (expected uses before replacement).
- **Job**: `hire_start_date`/`hire_end_date` (already exists), plus logged crew hours per stop (from `arrived_at`/`departed_at`, Section 2).
- **Damage record**: `repair_or_replacement_cost`, `recharged_to_client` (yes/no), linked to the Job.
- **Company setting**: `overhead_rate_percent` (optional, see 13.4).

### 13.2 Cost calculation (per job)

**Labour Cost** = Σ (crew_member_hours × crew_member_hourly_rate), summed across every staff member who logged time (install, destyle, styling assembly).

**Vehicle Cost** = Σ (vehicle_day_rate × days_used_on_this_job).

**Inventory Cost** = Σ (item_replacement_value ÷ item_useful_life_uses) for every item allocated — spreads ownership cost across every job an item is used on, rather than charging one job the full replacement value.

**Damage Cost** = Σ (repair_or_replacement_cost) for damage records on this job where `recharged_to_client` = No. (If recharged, it counts as revenue instead — see 13.3 — not both.)

**Total Cost** = Labour + Vehicle + Inventory + Damage (+ Overhead Allocation if used, see 13.4).

### 13.3 Revenue calculation (per job)

**Revenue** = Base Package Price + Add-on Revenue + Extension Revenue + Damage Recharge to Client.

### 13.4 Overhead allocation (optional — add later)

**Overhead Allocation** = Revenue × `overhead_rate_percent`. Leave at 0% until Labour/Vehicle/Inventory/Damage costs are proven accurate — overhead allocation is a rough estimate and can mask problems in the direct costs if added too early.

### 13.5 Final figures (per job)

**Gross Profit** = Revenue − Total Cost. **Profit Margin %** = Gross Profit ÷ Revenue × 100. Show both on the job record, visible to Admin (and Management if permitted).

### 13.6 Estimated vs. actual

**Estimated** (at quote stage): standard hours/inventory list, for spotting an under-priced quote before sending. **Actual** (once completed): real logged hours, real allocated inventory, real damage costs. Build **Actual** first — it's the number with real business value.

### 13.7 Rollups for the Admin Dashboard

- Average profit margin by month/quarter.
- Profitability by package/job type.
- Profitability by agent/lead source.
- Profitability by crew/team (flags consistently slower crews — a conversation starter, not an automatic penalty).
- Flag jobs below a set margin threshold (e.g. under 20%).

### 13.8 Visibility

Keep all cost/profitability figures Admin/Management-only. Stylists and Removalist Crews never see rates, costs, or margins.

---

## 14. Additional Features & Roadmap

Recommended additions beyond the core build, priority-tagged.

### 14.1 Quotes & Sales (high priority)
- **Package templates**: pre-built styling packages (e.g. "1-Bed Apartment," "4-Bed House") with standard inventory/price, still allowing custom add-ons.
- **Quote revisions**: keep version history rather than overwriting.
- **Quote expiry + auto follow-up**: remind the client and flag "stalling" to Management if unsigned after X days.
- **Deposit/payment on signing**: capture payment at e-signature via Xero or a payments provider.

### 14.2 Financial & Reporting (high priority)
- **Agent leaderboard**: revenue and job count by referring agent.
- **Average job value & conversion rate**: quotes sent vs. signed, by team member and period.
- **Overdue invoice alerts**: surfaced on the Admin Dashboard once Xero is connected.

### 14.3 Inventory & Warehouse (high priority — operational backbone)
- **Bundles/sets**: items used as a set (e.g. dining table + 6 chairs) move and get allocated together.
- **Low-stock alerts**: flag when popular items are fully allocated across active jobs.
- **Warehouse location/shelf tagging**: simple location codes (e.g. "Aisle 3, Shelf B") so items can actually be found.

### 14.4 Operations & Logistics (medium priority)
- **Vehicle capacity vs. job load**: a rough volume/weight check when assigning inventory to a vehicle.
- **Multi-stop run ordering**: order a day's stops sensibly (manual drag-to-reorder is enough at first; route optimization later).

### 14.5 Team & Compliance (medium priority)
- **Staff availability/roster**: avoid assigning someone already on leave or booked elsewhere.
- **Incident/WHS report**: a simple on-site incident form (injury, access issue, non-stock property damage).
- **Activity/audit log per job**: timestamped log of who changed what — most useful when something goes wrong.

### 14.6 Client Experience (medium priority)
- **Review/testimonial request**: auto-trigger a request a few days after a job is marked Completed.

### 14.7 System-wide (do these regardless of what else is built)
- **Global search**: one search bar across jobs, clients, agents, and inventory.
- **Mobile offline tolerance**: checklist ticks and photo uploads queue and sync when connection returns, rather than failing silently in low-signal properties/warehouses.
- **Notifications for key events**: a quote signed, a checklist fully completed, a key overdue for return, an item marked damaged, or a `Needs Attention` flag raised (Section 5).

---

## 15. Suggested Build Order

Build and test in this order, then layer in complexity:

1. **Core loop**: Clients → Quotes (with e-sign) → Jobs.
2. **Roles & logins**: Admin, Head Stylist/Management, Stylist, Removalist Crew, Client portal.
3. **Calendar** showing quotes and jobs.
4. **Inventory (Item Types + Location Ledger) + Stylist job-assembly flow** (Section 5) — Warehouse or Existing Pickup, with the availability check.
5. **Checklists + Removalist daily runs** (Appendix B), with photo/checklist completion.
6. **Keys tracking** with photo upload at pickup/drop-off.
7. **Admin Dashboard** (financials, pipeline, win/loss) and **End of Hire Tracker**.
8. **Automations**: the client email sequence (Section 11).
9. **Xero integration** last, once core data (jobs, quotes, pricing) is stable.

Once the above is working, fold in the high-priority items from Section 14 (package templates, bundles/sets, low-stock alerts, job profitability) before the medium-priority ones — those move the needle on daily operations the most.

---

## Appendix A. Standard Inclusions by Room (seed data for Room Templates)

Pulled from the business's existing Authority to Furnish document:

| Room Type | Standard Items |
|---|---|
| Hallway / Entry | Prints / Mirror |
| Bedroom – Master | Queen Bed; 2x Bedside Tables & Lamps; Print, Bed Covers, Throw & Cushions |
| Bedroom – Standard | Double Bed; 2x Bedside Tables & Lamps; Occasional Chair; Print, Bed Covers, Throw & Cushions |
| Bedroom – Single/Study | Single Bed; 2x Bedside Tables & Lamps; Study Desk; Study Chair; Print, Bed Covers, Throw & Cushions |
| Living Room – Front | 2.5–3 Seater Sofa; 1–2 Occasional Chairs; Coffee Table, Side Table & Rug; TV Unit; Print, Scatter Cushions, Throw & Decor Pieces |
| Living Room – Main | 2.5–3 Seater Sofa; 1–2 Occasional Chairs; Coffee Table, Side Table & Rug; Print, Scatter Cushions, Throw & Decor Pieces |
| Kitchen & Meals | 6–8 Seater Dining Table; 6–8 Dining Chairs; Print; Decor Pieces |
| Bathroom & Laundry | Towels & Decor Pieces |
| Outdoor Setting | Outdoor Setting; Décor |

The source document only has one Living Room variant used twice (Front/Main) and doesn't cover other room types (e.g. a rumpus room). Add new templates using the same structure if those come up regularly — or just use the `+ Custom Room` option (Section 4) on the day.

---

## Appendix B. Default Checklist Content (seed data for Checklists)

Deliberately short, so crews actually finish them — still fully editable/custom per job type.

**Install — Arrival**
1. Confirm correct property/address
2. Confirm key access
3. Quick photo of the property's existing condition before anything is brought in
4. Floor/surface protection placed for any heavy items, if needed

**Install — Departure**
1. Every item on the job's sourced list is placed in its assigned room
2. Styling matches the reference photos/quote
3. Property left clean — no packaging, offcuts, or rubbish left behind
4. Any damage noticed (pre-existing or caused during install) photographed and logged on the spot
5. Keys handled per instructions, status updated
6. Delivery/placement photos taken per room (handoff photos for the Stylist — not the final client-facing shots)
7. Whole-crew sign-off before the stop is marked complete

**De-install/Pickup — Arrival**
1. Confirm correct property/address
2. Confirm key access
3. Quick photo of condition before starting removal
4. Confirm the expected item list against what's actually there — flag any discrepancy immediately

**De-install/Pickup — Departure**
1. All listed items collected and loaded
2. Any damage — to the furniture or the property — photographed and logged on the spot
3. Property left clean, final walkthrough done
4. Keys handled per instructions, status updated
5. Whole-crew sign-off before the stop is marked complete

**Warehouse Departure** (start of day, once per crew — not per job)
1. All Warehouse-sourced items for today's jobs loaded, checked against each job's sourced list
2. Any items still flagged `Needs Attention` resolved or explicitly escalated before leaving
3. All keys needed for today's stops accounted for
4. Tools/equipment loaded: furniture blankets/pads, moving straps, dolly/trolley, basic tool kit
5. Fragile or special-handling items identified and loaded with appropriate care
6. Vehicle pre-departure check: fuel level and a quick visual condition check
7. Loading order matches today's stop order — last on, first off
8. All assigned crew members present and confirmed

**Team sign-off applies to all five checklists above**: individual items can be ticked by whoever does that task, but a checklist can't be cleared on one person's tick alone — every crew member on that stop/run confirms before moving on.

---

### Notes for whoever builds this
- Treat "Job" as the central record everything else attaches to — client, agent, keys, photos, inventory, checklist, crew, and vehicle should all be visible from one job screen.
- Stylist and Removalist Crew views must be simple and mobile-first.
- A Job can't move to `Completed` until its checklist(s) are fully signed off — the main safeguard against jobs slipping through incomplete.

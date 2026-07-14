# Open Questions & Decisions Log

Things that are genuinely undecided, or that were decided assuming a no-code platform and now need a real technical answer. Work through the "Technical Stack" section with the developer before anything else — it affects almost every estimate they'll give you.

## Technical Stack (decide first — everything else depends on this)

The original spec assumed a no-code AI builder (Base44), which provides authentication, file storage, email sending, and hosting out of the box. A custom-built system needs each of these chosen explicitly:

- **Framework/stack**: your developer will have a recommendation — ask for their reasoning, not just their preference (team familiarity, hiring pool, longevity all matter more than "best" in the abstract).
- **Hosting**: where the app and database live.
- **Authentication**: staff logins (email/password? SSO?) and the client magic-link mechanism (Section 1) need a real implementation — typically a signed, time-limited or single-use token embedded in the URL.
- **File storage**: for the volume of photos this system generates (room photos, delivery photos, damage photos, completion photos, key handover photos) — needs proper cloud storage (e.g. S3-compatible), not database blobs.
- **Email sending**: a transactional email provider (e.g. SendGrid, Postmark, SES) for the automated sequence in Section 11.
- **SMS provider**: Section 11 mentions SMS "if the platform supports it" — decide whether SMS is in scope for launch, and if so, which provider (e.g. Twilio).
- **Mobile approach**: the spec requires mobile-first web views for Stylists and Removalist Crew (Sections 4, 5, 7). Confirm this means responsive web, not a native app — a much bigger scope difference.

## Product Decisions Still Open

- **Quote pricing model** (Section 4): Option A (flat manual price, room builder only drives the internal furniture list) vs. Option B (itemized pricing, quote totals itself automatically). Spec recommends starting with A. Confirm before the Room Builder epic is built, since it changes what fields are required on Quote Line Items.
- **Deposit/payment on signing** (Section 14.1): not yet decided whether this is in scope for initial launch or a later addition. If in scope, needs a payments provider decision (via Xero, or a separate processor like Stripe).
- **Overhead allocation** (Section 13.4): explicitly deferred until direct cost tracking (labour/vehicle/inventory/damage) is proven accurate. No action needed now — just don't build this prematurely.
- **"Save as Template" for custom rooms** (Section 4): flagged as optional/nice-to-have. Confirm priority — low effort, but not essential for launch.
- **Week-to-week pending extension check-ins** (Section 10): spec says this should "resurface on the tracker each week" — decide the exact automation (a recurring internal reminder? a recurring client email?) or leave it as a manual Management habit initially.
- **Bond/security deposit**: explicitly out of scope — the business has confirmed this is being removed from their terms and conditions. No bond fields, workflows, or reporting are needed anywhere in the system. (Flagged here so it isn't accidentally reintroduced by a developer reading older staging-industry conventions into the spec.)

## Confirm at Kickoff, Not Urgent
- Exact SMS copy/timing if SMS is built (Section 11 gives triggers, not exact wording).
- Whether Admin and Head Stylist/Management need genuinely separate permission sets from day one, or whether a single configurable "reduced financial visibility" flag (Section 1) is sufficient for launch.
- Whether the QR/barcode-per-unit upgrade path (mentioned in Section 5 as a future option) should be designed for now (e.g. leaving a nullable `unit_code` field on inventory records) even though it won't be used at launch — cheap to leave room for, expensive to bolt on later.

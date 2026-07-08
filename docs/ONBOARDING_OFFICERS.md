# Officer Onboarding

This guide is for officers using the admin/officer tools to run events and manage check-ins.

## Access

Officers must have `members.role` set to `officer` (or `admin`). If you can’t see officer pages, ask an admin to grant access.

## Quickstart checklist

- Confirm you can access:
  - Officer Events: `/officer/events`
  - Officer Members: `/officer/members`
- Verify the current semester is set correctly and active.

## Running an event (end-to-end)

### 1) Create the event
- Go to **Officer Events**
- Click **New Event**
- Choose:
  - Category and point value
  - Scope:
    - **CSA-wide**
    - **JT shared**
    - **JT specific** (must select a Jiating)
  - Check-in type:
    - **Self/QR** (generates a check-in QR/link)
    - **Officer** (manual check-in)

### 2) Check-in members

#### Option A: Self check-in (QR)
- Open the event QR page (officer tools)
- Display QR code at the event
- Members scan and submit check-in

#### Option B: Officer check-in
- Open the event check-in page
- Search/filter members
- Check them in as they arrive

### 3) Verify attendance
- Confirm attendance count on the event detail page.
- If there are duplicates or errors, coordinate with an admin for correction policies.

## Member lookup

Officer Members is paginated (25 per page). Use search + JT filter for fast lookup.

## Common issues

- **Member can’t see JT-specific event**: ensure their Jiating is assigned and they’re active; ensure event has correct `jt_family_id`.
- **QR link doesn’t work**: ensure event check-in type is self/QR and a check-in code exists.


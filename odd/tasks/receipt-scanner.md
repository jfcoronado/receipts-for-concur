# Receipt Scanner for Concur

Status: in progress. Workflow: Organic Driven Development (ODD), classified large.
Test runner: `node --test` (unit), Playwright (browser). TDD: observed RED, then GREEN, then REFACTOR.
Engram mirror: not created, because Engram is not installed on this machine. This file is the only record.

## Specs

- **S1 Installs free on iPhone.** Runs as a web app added through Safari's "Add to Home Screen". Needs no Apple Developer account, no paid service, and no app-specific server.
  - Accept: static files only; has a valid manifest and `apple-touch-icon`; opens standalone.
- **S2 Scans a receipt.** The user takes a photo with the iPhone camera or picks one from the library, then adjusts four corners and can rotate.
  - Accept: the corners produce a perspective-corrected image; the output is a JPEG with a longest side of at most 2000 px.
- **S3 Readable output.** An optional "Enhance" step raises contrast for faded thermal paper. It is on by default.
- **S4 Receipts survive.** A scanned receipt stays on the phone until the user deletes it, and scanning works offline.
  - Accept: the queue persists across reloads; each item is `pending` or `shared`; file names look like `receipt-YYYYMMDD-HHMMSS.jpg`.
- **S5 Reaches Concur by email.** "Send" opens the iPhone share sheet with the JPEG attached, and the destination address is copied to the clipboard in the same tap.
  - Default address: `receipts@concur.com`, editable in settings (for example `receipts@expenseit.com`).
  - Accept: a completed share marks the item `shared`; cancelling leaves it `pending`; where file sharing is unsupported, the app says so and offers a download.
- **S6 Honest status.** The app never claims a receipt reached Concur, because it cannot know. The label is "Shared".
- **S7 Stays private.** Receipt images leave the phone only when the user shares them. No analytics and no third-party requests.

### Known constraints

- The Web Share API cannot pre-fill the recipient, so Mail needs the address pasted or autocompleted.
- Concur only accepts email from an address verified on the user's Concur profile. Receipts land in Available Receipts and are not attached to an expense.
- Automated tests cannot prove the iOS share sheet or Mail flow. Only a real iPhone can (T7).

## Tasks

- [ ] T1 | S2, S3 | Geometry, perspective warp, enhance (pure modules, TDD) | commit: -
- [ ] T2 | S4 | Receipt queue and file naming (TDD) | commit: -
- [ ] T3 | S5, S6 | Share flow and outcomes (TDD) | commit: -
- [ ] T4 | S2, S3, S4, S5, S6 | UI and IndexedDB wiring | commit: -
- [ ] T5 | S1, S4, S7 | Manifest, icons, service worker | commit: -
- [ ] T6 | S1 to S7 | Browser end-to-end test | commit: -
- [ ] T7 | S1, S5 | Publish over HTTPS and prove on a real iPhone. Needs user approval and the user's phone | commit: -

## Log

- **L1 (original request, verbatim):** "I want to create an application that works in my iphone that allow me to scan the recepients to upload to Concur. Concur app for some reason is not working for me. I don't have Apple developer account and don't want to pay for it. I want to develop the app using ODD methodology."
- **L2 (user decisions):** ODD means Organic Driven Development. Upload route is "Email to Concur".
- **L3 (reading "recepients"):** treated as "receipts", since the request is about uploading to Concur.
- **L4 (research):** Concur email route and verification requirement come from SAP Concur community pages. ODD protocol comes from the gentle-ai README and docs/usage.md.

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
- **S5b OneDrive and Outlook route (added after L11, replaces "a completed share marks the item shared").** "Share" opens the share sheet so the user can save to OneDrive. "Open Outlook" copies the address and opens an Outlook draft through `ms-outlook://compose`. The user attaches the file from OneDrive.
  - Accept: a completed share leaves the item `pending`; "Mark sent" is the only thing that changes it.
- **S6 Honest status.** The app never claims a receipt reached Concur, because it cannot know. The label is "Marked sent", and only the user sets it.
- **S7 Stays private.** Receipt images leave the phone only when the user shares them. No analytics and no third-party requests.

### Known constraints

- The Web Share API cannot pre-fill the recipient, so Mail needs the address pasted or autocompleted.
- Concur only accepts email from an address verified on the user's Concur profile. Receipts land in Available Receipts and are not attached to an expense.
- Automated tests cannot prove the iOS share sheet or Mail flow. Only a real iPhone can (T7).

## Tasks

- [x] T1 | S2, S3 | Geometry, perspective warp, enhance (pure modules, TDD) | commit: 5572d9e
- [x] T2 | S4 | Receipt queue and file naming (TDD) | commit: 8acf8eb
- [x] T3 | S5, S6 | Share flow and outcomes (TDD) | commit: f614238
- [x] T4 | S2, S3, S4, S5, S6 | UI and IndexedDB wiring | commit: 942838c
- [x] T5 | S1, S4, S7 | Manifest, icons, service worker | commit: f0a6aa0
- [x] T6 | S1 to S7 | Browser end-to-end test, in Chromium only | commit: 5589490
- [ ] T7 | S1, S5 | Publish over HTTPS and prove on a real iPhone. Needs user approval and the user's phone | commit: -
- [x] T8 | S5b, S6 | OneDrive and Outlook route, with user-confirmed "Mark sent" (TDD) | commit: 94d0995

## Log

- **L1 (original request, verbatim):** "I want to create an application that works in my iphone that allow me to scan the recepients to upload to Concur. Concur app for some reason is not working for me. I don't have Apple developer account and don't want to pay for it. I want to develop the app using ODD methodology."
- **L2 (user decisions):** ODD means Organic Driven Development. Upload route is "Email to Concur".
- **L3 (reading "recepients"):** treated as "receipts", since the request is about uploading to Concur.
- **L4 (research):** Concur email route and verification requirement come from SAP Concur community pages. ODD protocol comes from the gentle-ai README and docs/usage.md.
- **L5 (unit test proof):** RED observed for T1 to T3, with all four test files failing on missing modules. An earlier failing run was invalid, because the runner could not load the test folder. GREEN: 34 of 34 tests pass.
- **L6 (browser test proof):** no valid RED for T4 to T6. The first run timed out waiting for the server and never reached a test, and the UI was written straight after. To compensate, seven behaviours were broken on purpose and the tests caught all seven: share not recorded, offline cache off, corner drag off, rotate off, saving off, address not copied, delete without asking. GREEN: 19 of 19 tests pass in Chromium.
- **L7 (not proved):** WebKit can't launch on this machine, because Playwright's build needs libicu74 and libflite1, so nothing has run on a Safari engine. The share sheet and clipboard are stubbed in browser tests. T7 must cover these on a real iPhone: install, camera capture, the real share sheet, whether the copy and share work together in one tap, and arrival in Available Receipts.
- **L8 (visual review):** screens and a sample scan checked at phone size. When the corners are left wide of the receipt, Enhance turns the table black and lifts the paper to white, but text stays mid-grey. It's still readable, and cropping properly avoids it.
- **L9 (published, T7 part 1):** user approved a public repo and GitHub Pages. Live at https://jfcoronado.github.io/receipts-for-concur/ from `main`. Checked on the live site in Chromium: all 15 app files return 200, the service worker takes control, the app opens offline, an offline scan and simulated send work, and there are no third-party requests or page errors. T7 stays open until the real iPhone checks in L7 are done.
- **L10 (iPhone test):** user reports that sharing to corporate Outlook opens it and it closes straight away. The same happens when sharing a photo from the Photos app, so the receipt app isn't the cause. Company policy on Outlook is suspected but unconfirmed. Still open: what the user sees with the To address. The app also labels a receipt "Shared" for any completed share, such as Save Image, so the label can be wrong.
- **L11 (working route, reported by user):** "I had to save the image to onedrive and from OneDrive I could attach it to Outlook. I sent email to receipts@concur.com and it worked"
- **L12 (T8 proof):** valid RED observed: 12 browser tests failed and the unit test file couldn't load the missing export. GREEN: 37 unit and 22 browser tests pass in Chromium. The tests also caught a bug in the change, where the new Outlook link stopped the Download link from appearing. Not proved: whether `ms-outlook://compose` opens Outlook and fills in To on a real iPhone, since that link format comes from secondhand sources.
- **L13 (iPhone test, reported by user):** "Outlook opens, it add the address. Phone camera open great." This proves Open Outlook and the To field, and that the camera opens. T7 stays open for: photo orientation, dragging corners by finger, opening offline, and a receipt sent through the updated app appearing readable in Available Receipts.

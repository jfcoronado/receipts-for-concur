# Receipts for Concur

Scan receipts on an iPhone and email them to SAP Concur. It's a web app you add to your Home Screen, so it needs no App Store, Apple Developer account, or server of its own.

## How it works

1. Scan a receipt, or pick a photo from your library.
2. Drag the four corners onto the receipt's edges, then save.
3. Tap **Share** and save the JPEG to OneDrive.
4. Outlook should open a draft by itself once the save finishes. If it doesn't, tap **Open Outlook**. Attach the file from OneDrive and send it to the Concur address. If the To field is empty, paste the address, which the app has copied.
5. Tap **Mark sent**.
6. Look for the receipt under **Available Receipts** in Concur, then attach it to an expense there.

This route exists because corporate Outlook closes straight away when a file is shared to it from the iPhone share sheet. If your email app accepts shared files, you can choose it directly in step 3.

Receipt images stay on your phone until you share them.

## Setup

**In Concur (one time):** on the Concur website, open Profile Settings and verify the email address you send from. Concur only accepts receipts from a verified address.

**On your iPhone:** open the app's HTTPS address in Safari, tap Share, then **Add to Home Screen**. Use the installed app from then on, because receipts saved in Safari don't carry over to it.

If `receipts@concur.com` bounces, ask your Concur administrator which address to use and change it in Settings.

## Limits

- The app can't attach the file to the Outlook draft, so you attach it yourself.
- "Marked sent" only records that you tapped the button. It doesn't confirm that Concur received the receipt.
- You place the corners by hand. There's no automatic edge detection.
- iOS can clear a web app's storage, for example when the phone is very low on space. Treat Concur as the permanent copy.

## Development

```sh
npm install
npm test           # unit tests
npm run test:e2e   # browser tests (expects Chromium at /usr/bin/chromium)
npm run serve      # http://localhost:4173
```

To release a change, update `VERSION` in `sw.js`, or installed phones keep the old files. Add any new file to the `FILES` list there too.

This project uses Organic Driven Development. The specs, tasks and log are in `odd/tasks/receipt-scanner.md`.

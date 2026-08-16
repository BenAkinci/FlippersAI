# FlippersAI Chrome Workspace

Manifest V3 side-panel extension for authenticated marketplace capture and the operational FlippersAI buying/selling workflow.

## What stays in the extension

- Scan the rendered marketplace listing while the user is logged in
- Capture listing text, title, price, seller/location details, product images where accessible, and a visible browser screenshot
- Create/update the shared Supabase Deal File
- Verify and analyse the deal
- Seller questions, reply review, negotiation, inspection and purchase recording
- Preparation and listing plans
- Listing publication record, offers, sale agreement, fulfilment, delivery, payout and close
- Deals and operational inventory
- Compact side-panel mode or full extension workspace
- Handoff to the FlippersAI website at any point

## What intentionally stays website-only

Profile and identity management, category administration, finances and ledger editing, reset/destructive data tools, Community Intel watch administration, and other account/background operations.

## Development install

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Choose **Load unpacked** and select this `extension` folder.
4. Pin FlippersAI if desired, then open a supported marketplace listing and click the extension action.

The extension uses the same Supabase project as the website. Users can import an existing website session or sign in directly in the extension.

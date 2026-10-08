# EcoSync — pitch notes

**One line:** A second life for your scrap. Scan it, sell it to a collector nearby, and follow it to its next life.

**The problem:** Homes throw away scrap that has value because they don't know what it's worth or who will take it. Collectors waste time going door to door. Nobody can show where waste actually ends up.

## The features
1. **On-device AI scanner** — names the item, plastic number, hazard, price per kilo and CO₂ saved. Runs in the browser, so the photo never leaves the phone.
2. **QR material passport** ★ — every sale gets an ID like `ES-7K2P-QX9M`. Listed → Reserved → Handed over → At hub → Processed → Reborn.
3. **QR handshake** ★ — the sale completes only when the collector scans the seller's QR at pickup.
4. **Direct UPI payments** — buyers pay the seller's UPI ID with any UPI app (QR or one-tap link), or cash. No commission, no gateway.
5. **Green Route pickups** ★ — a slot gets a leaf when another pickup is already booked within 2.5 km. Shared trips, +25 coins.
6. **3D litter map** ★ — pin garbage spots on a 3D city; neighbours confirm (+2), whoever cleans up earns +40.
7. **Real recycling hubs** — live OpenStreetMap data with filters, directions and Street View.
8. **Seller and collector modes** — one account, switch anytime.
9. **Say it in Hindi** — "paanch kilo akhbaar" fills in the listing.
10. **Upcycle ideas** — three projects for every material.
11. **EcoBot** — sorting rules, rates, e-waste law, composting, in Hindi or English.
12. **EcoCoins and rewards** — saplings, metro top-ups, notebooks.
13. **Ward Wars** — wards ranked by kilos recycled.
14. **Neon Postgres** — real accounts and data, hashed passwords.
15. **Android app + installable web app.**

★ = lead with these.

## 3-minute demo
1. Landing (20 s): scroll slowly — the card, "Different sides. One clean pickup.", the live preview stepping through.
2. Take the tour (20 s): two or three steps.
3. Create a seller account (15 s), add a UPI ID.
4. Scan a bottle (30 s) → List it.
5. Second browser / phone: create a collector account (15 s) → Market → Reserve → pay by UPI QR.
6. Seller shows handshake QR → collector scans it → "Handed over" (30 s).
7. Maps (30 s): real hubs, then the 3D map → Orbit → Report litter.
8. Close: EcoCoins and Ward Wars (10 s).

## Judge questions
- **Is the AI real?** Yes, MobileNet runs in the browser with TensorFlow.js. No server, no key, works offline after the first load.
- **Is the data real?** Yes, it's in Neon Postgres. Show the tables in the Neon console.
- **Are payments safe?** Money goes straight from the buyer's UPI app to the seller's UPI ID. EcoSync never holds money. The QR handshake proves the handover happened.
- **How does it make money later?** Optional featured listings for collectors, sponsored rewards, and passport data for brands that must prove recycling under Extended Producer Responsibility rules.

# EcoSync — pitch notes

**One line:** EcoSync turns household scrap into money and points: AI identifies and prices it, a nearby buyer books the pickup, and a QR passport follows every kilo to its next life.

**The problem:** Indian homes throw away sellable scrap because they don't know what it's worth, who will take it, or whether it is actually recycled. Kabadiwalas can't find sorted material reliably, and nobody can prove where waste ends up.

## Required by the brief
| Brief asks for | EcoSync |
|---|---|
| Pickup scheduling | 7-day slot picker, pickup code, live van tracking, Green Route bonus slots |
| Recycling rewards | EcoCoins for listing, selling, pickups, reporting and cleaning; tiers; real rewards (saplings, metro top-ups, notebooks) |
| One unique feature | **QR Material Passport + Handshake Escrow** (plus three more below) |
| Built with an AI platform | Gemini vision, chat and image generation throughout |

## The 15 features
1. **AI waste scanner** — camera or photo → item, material, resin code (1–7), hazard warning, prep steps, ₹ value, CO₂ avoided.
2. **QR material passport** ★ — every sale gets an ID like `ES-7K2P-QX9M` and a QR label. Timeline: Listed → Paid → Picked up → At hub → Processed → Reborn. Anyone can scan it; no personal data shown.
3. **Handshake escrow** ★ — buyer pays first; money is released to the seller only when the buyer scans the seller's QR at pickup. Kills "came, didn't pay" and "paid, didn't get it".
4. **Green Route pickups** ★ — slots where a van is already nearby are marked with a leaf and earn +25 coins. Fewer trips, less fuel.
5. **3D litter map** ★ — pin garbage hotspots on a 3D city; neighbours confirm (+2), whoever cleans it earns +40. Column height = severity × confirmations.
6. **Real recycling hubs nearby** — live OpenStreetMap data (recycling centres, e-waste points, scrap yards, transfer stations) with filters, directions and Street View "Look around".
7. **Buyer and seller modes** — one account, switch anytime. Sellers list; buyers (kabadiwalas, recyclers, upcyclers) browse by distance and material.
8. **Secure payments** — Razorpay UPI/cards with server-side signature verification.
9. **Proper email sign-in** — 6-digit email codes, or Firebase (Google, password, magic link).
10. **Speak to list, in Hindi** — "paanch kilo akhbaar" → listing filled by Gemini.
11. **Upcycle Studio** — Gemini suggests 3 DIY projects and generates a picture of the result.
12. **EcoBot** — Hindi/Hinglish/English assistant for sorting rules, rates and e-waste law.
13. **Ward Wars** — monthly ward leaderboard by kilos recycled.
14. **Impact wallet** — kg recycled, CO₂ avoided, car-km and tree-years equivalents.
15. **Android app + installable PWA** — opens to the scanner; uses camera and GPS.

★ = signature features to emphasise.

## More ideas you can pitch as "next steps"
- **Smart-bin fill prediction** — learn each home's pattern and suggest the best pickup day.
- **Society dashboards** — RWAs see their building's recycling rate and get a monthly certificate.
- **EPR credits for brands** — passports prove plastic was recycled, which brands need under India's Extended Producer Responsibility rules.
- **Collector app** — a version for kabadiwalas with route optimisation across the day's pickups.
- **School eco-clubs** — class vs class challenges, with coins donated to the club.
- **Offline SMS/WhatsApp booking** for people without smartphones.
- **Carbon receipts** — a shareable card after each sale ("You saved 5.3 kg CO₂").

## 3-minute demo script (for the audition)
1. **Intro (15 s)** — open the site; the logo animation plays. "Scan it, sell it, see what it becomes."
2. **Landing (20 s)** — point to the live passport card moving through its journey. "This is the idea: every kilo gets a passport."
3. **Sign in (15 s)** — "Sell my scrap" → email → 6-digit code.
4. **Scan (30 s)** — upload/point at a bottle → resin code 1, rinse first, ₹ value, CO₂. Tap **Upcycle Studio**.
5. **List (15 s)** — "List for ₹…", or press **Speak your listing** and say it in Hindi.
6. **Switch to Buyer (40 s)** — Marketplace → Buy → escrow screen → pay → passport created. "Show the seller's QR" → buyer scans → **Payment released**.
7. **Maps (30 s)** — Hubs: real recycling centres near the school, Directions, Look around. Then **3D litter map** → Orbit → Report litter.
8. **Pickups + wallet (15 s)** — book a Green Route slot (+35 coins), show tier progress and rewards.
9. **Close (10 s)** — "Works on web and Android. Every feature runs on Gemini."

## Likely judge questions
- **Is the AI real?** Yes — Gemini vision identifies the item from the photo. Without a key the app shows labelled sample answers so the demo never breaks.
- **Are the hubs real?** Yes — fetched live from OpenStreetMap through the Overpass API. If OSM is unreachable, samples are shown and labelled.
- **Is the payment real?** Razorpay test mode by default; switching to live keys accepts real UPI. Signatures are verified on the server.
- **How do you stop fraud?** Escrow + QR handshake: the seller is paid only when the buyer physically scans their code.
- **How does EcoSync earn money?** 3–5% commission on buyer payments, sponsored rewards from brands, and EPR passport data for producers.

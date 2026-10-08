// EcoBot's built-in knowledge, used when no Gemini key is configured. Works fully offline.
// Each entry: keywords (English, Hinglish, Hindi) → answer.
const KB = [
  [/batter|cell|inverter/i, 'Batteries never go in the dry or wet bin. Tape the ends of lithium batteries and give them to an e-waste collection point or a battery shop that takes old ones back. Lead-acid inverter batteries have resale value at any scrap dealer.'],
  [/e-?waste|phone|mobile|laptop|charger|cable|wire|electronic|tv|computer/i, 'Electronics are e-waste. Under India\'s E-Waste (Management) Rules they must go to an authorised recycler or a brand take-back point. Wipe your data first. Open Maps and filter "E-waste" to find the nearest drop-off. Copper wire alone sells for about ₹500–600/kg.'],
  [/rate|price|kitna|bhav|worth|paisa|value|kya milega/i, 'Typical scrap rates (₹/kg): newspaper 12–15, cardboard 8–11, PET bottles 18–25, hard plastic (HDPE) 22–28, aluminium cans 100–120, iron 28–35, copper 500–600. Clean, dry and sorted scrap always gets the top of the range.'],
  [/akhbaar|newspaper|paper|magazine|kitab|book|kaagaz/i, 'Paper is worth more dry and sorted. Keep newspapers separate from magazines and notebooks, tie them in 5 kg bundles, and remove plastic covers. Wet or oily paper (like used tissues) goes in the wet bin.'],
  [/pizza|oily|greasy|tissue/i, 'Greasy paper like pizza boxes and used tissues can\'t be recycled with clean paper. Tear off the clean lid to recycle it; the oily part goes in the wet bin or compost.'],
  [/carton|tetra|juice|milk pack|doodh/i, 'Tetra Paks are recyclable but need a special collector. Rinse, flatten and keep them separate from paper. Many cities have Tetra Pak drop boxes at supermarkets.'],
  [/polythene|plastic bag|thaili|panni|wrapper|chips|multilayer/i, 'Thin carry bags and chip wrappers (multi-layer plastic) are hard to recycle and fetch little money. Collect them clean and dry in one bag and give them to a dry-waste collector; never burn them.'],
  [/bottle|botal|pet|plastic/i, 'Check the number inside the recycling triangle. 1 (PET bottles) and 2 (HDPE cans) are the most valuable. Rinse, remove caps and labels, and crush them flat. Caps are usually type 5 (PP) and can go in the same bag.'],
  [/glass|kaanch|sheesha|jar/i, 'Glass is 100% recyclable but low in value (₹2–4/kg). Keep it separate so it doesn\'t injure collectors. Wrap broken glass in newspaper and label it "glass".'],
  [/can|alumin|tin|metal|loha|iron|steel|tamba|copper|brass|peetal/i, 'Metals are the most valuable scrap in a home. Aluminium cans fetch ₹100–120/kg, copper ₹500–600/kg, brass ₹350–400/kg, iron ₹28–35/kg. Keep them separate; mixed metal is paid at the lowest rate.'],
  [/compost|wet|food|kitchen|peel|sabzi|khana|organic|geela/i, 'Kitchen waste makes great compost. Mix it with dry leaves or shredded cardboard in a 1:2 ratio, keep it as moist as a squeezed sponge and turn it every week. Compost is ready in 6–8 weeks.'],
  [/medicine|dawai|syringe|needle|sanitary|diaper|pad/i, 'Medicines, syringes, diapers and sanitary pads are domestic hazardous or sanitary waste. Wrap them in newspaper, mark them with a red X and hand them separately to your waste collector. Many chemists take back expired medicines.'],
  [/clothes|kapde|kapda|textile|shoes|joote/i, 'Wearable clothes can be donated; worn-out cotton sells as rags for ₹6–10/kg. Shoes and bags go to donation bins. Avoid putting textiles in the wet bin.'],
  [/segregat|sort|alag|kaise|how to separate|bin|kooda|kachra|dustbin/i, 'Use three bins: green for wet (food, peels, flowers), blue for dry (paper, plastic, metal, glass) and a separate bag for hazardous items (batteries, medicines, bulbs). Keep dry waste clean so it can be sold.'],
  [/bulb|tube|cfl|led/i, 'CFLs and tube lights contain mercury. Don\'t break them; wrap them and give them to an e-waste collector. LED bulbs are e-waste too.'],
  [/pickup|collect|book|schedule|kab aayega/i, 'Open Pickups, choose a day and time and tell us roughly how much you have. Slots marked with a leaf already have a collection nearby, so they earn 25 bonus EcoCoins.'],
  [/coin|reward|point|redeem/i, 'You earn EcoCoins for listing scrap (+5), booking a pickup (+10), Green Route slots (+25), reporting litter (+15), cleaning a spot (+40) and every kilo sold (+10/kg). Redeem them in the EcoCoins tab.'],
  [/passport|qr/i, 'Every sale on EcoSync gets a material passport: a QR code that records each handover, from your door to the recycler. Scan it any time to see where your scrap went.'],
  [/upi|pay|payment|paise kaise/i, 'Buyers pay sellers directly by UPI (scan the seller\'s UPI QR in the app) or in cash at pickup. The sale is only completed when the buyer scans the seller\'s handshake QR, so both sides are protected.'],
  [/hi|hello|namaste|hey/i, 'Namaste! Ask me what goes in which bin, what your scrap is worth, or where to drop off e-waste.'],
];
export function ecobotAnswer(text = '') {
  const hits = KB.filter(([re]) => re.test(text));
  if (hits.length) return hits.slice(0, 2).map(([, a]) => a).join('\n\n');
  return 'I can help with sorting rules, scrap prices, e-waste, composting and how EcoSync works. Try "Where do old batteries go?", "Akhbaar ka rate kya hai?" or "How do I compost at home?"';
}

const MAT = [[/akhbaar|news|paper|kaagaz|अखबार/i, 'paper'], [/gatta|carton|box|cardboard|डिब्बा/i, 'cardboard'], [/bottle|botal|pet|बोतल/i, 'pet'], [/can|alumin|tin/i, 'aluminium'], [/loha|iron|steel|लोहा/i, 'steel'], [/copper|tamba|तांबा/i, 'copper'], [/kaanch|glass|sheesha/i, 'glass'], [/kapde|clothes|kapda|कपड़े/i, 'textile'], [/phone|laptop|charger|e-?waste|tv/i, 'e_waste'], [/plastic/i, 'mixed_plastic']];
const NUM = { ek: 1, do: 2, teen: 3, char: 4, chaar: 4, paanch: 5, panch: 5, chhe: 6, saat: 7, aath: 8, nau: 9, das: 10, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
export function parseListing(text = '') {
  let kg = Number((text.match(/(\d+(?:\.\d+)?)\s*(kg|kilo|किलो)/i) || [])[1]);
  if (!kg) { const w = (text.toLowerCase().match(/\b(ek|do|teen|chaa?r|paa?nch|chhe|saat|aath|nau|das|one|two|three|four|five|six|seven|eight|nine|ten)\b\s*(kg|kilo)/) || [])[1]; kg = NUM[w] || 2; }
  const material = (MAT.find(([re]) => re.test(text)) || [, 'other'])[1];
  const notes = /sookha|dry/i.test(text) ? 'Dry' : '';
  return { title: text.trim().slice(0, 60), material, kg, notes };
}

// Upcycling ideas by material, shown in Upcycle Studio.
export const UPCYCLE = {
  pet: [['Self-watering herb planter', '25 min', ['Cut the bottle two-thirds of the way up', 'Turn the top upside down into the base with a cotton wick', 'Fill with soil and plant coriander or mint']], ['Vertical garden pocket', '30 min', ['Cut a window in the side of the bottle', 'Hang several from a balcony grill with twine', 'Plant succulents or money plant cuttings']], ['Bird feeder', '20 min', ['Make two holes opposite each other near the base', 'Push a wooden spoon through as a perch', 'Fill with grains and hang it in a tree']]],
  aluminium: [['Tea-light lantern', '30 min', ['Fill the can with water and freeze it', 'Punch a pattern with a nail and hammer', 'Thaw, dry and place a tea light inside']], ['Desk pen stand', '15 min', ['Remove the top with a can opener and file the edge', 'Wrap with leftover fabric or paint it', 'Glue three cans together for a set']], ['Wind chime', '40 min', ['Cut and flatten can sides into strips', 'Punch a hole in each', 'Hang from a stick at different lengths']]],
  paper: [['Papier-mâché bowl', '1 hr + drying', ['Tear paper into strips', 'Dip in flour-water paste and layer over a balloon', 'Pop the balloon when dry and paint']], ['Seedling pots', '15 min', ['Roll newspaper around a glass, fold the base', 'Fill with soil and seeds', 'Plant the whole pot when the seedling is ready']], ['Gift wrap and envelopes', '10 min', ['Pick colourful pages', 'Fold and glue into envelopes', 'Seal with a sticker']]],
  cardboard: [['Drawer organiser', '30 min', ['Measure your drawer', 'Cut and slot strips into a grid', 'Cover with leftover gift paper']], ['Cat scratch pad', '45 min', ['Cut 5 cm strips of corrugated card', 'Roll them tightly into a disc', 'Glue the end and tie with string']], ['Laptop stand', '40 min', ['Cut two triangles from a thick box', 'Slot a cross-piece between them', 'Tape the edges for strength']]],
  glass: [['Fairy-light jar', '10 min', ['Clean and dry the jar', 'Coil a battery string light inside', 'Use as a night light']], ['Spice jars', '20 min', ['Soak off labels', 'Paint the lids', 'Label with chalkboard stickers']], ['Terrarium', '30 min', ['Layer pebbles, charcoal and soil', 'Add small succulents', 'Mist lightly once a week']]],
  textile: [['Tote bag from a T-shirt', '20 min', ['Cut off the sleeves and neckline', 'Cut fringe at the bottom hem', 'Tie the fringe strips together']], ['Braided rug', '2 hrs', ['Cut old clothes into long strips', 'Braid three strips together', 'Coil the braid and stitch it flat']], ['Cleaning rags', '10 min', ['Cut cotton clothes into squares', 'Hem the edges if you like', 'Use instead of paper towels']]],
  e_waste: [['Cable organiser', '15 min', ['Cut a toilet-roll tube in half', 'Coil each cable into one', 'Label with the device name']], ['Repair café parts box', '20 min', ['Keep working screws, buttons and chargers', 'Sort them in a labelled box', 'Donate to a local repair café']], ['Circuit-board coasters', '30 min', ['Only use boards with no batteries attached', 'Seal with clear resin', 'Glue felt on the back']]],
};
UPCYCLE.cardboard ||= UPCYCLE.paper; UPCYCLE.hdpe = UPCYCLE.pet; UPCYCLE.mixed_plastic = UPCYCLE.pet; UPCYCLE.steel = UPCYCLE.aluminium; UPCYCLE.copper = UPCYCLE.e_waste;
export const upcycleFor = (m) => (UPCYCLE[m] || UPCYCLE.cardboard).map(([title, time, steps]) => ({ title, time, steps }));

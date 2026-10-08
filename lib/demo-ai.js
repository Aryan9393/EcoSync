// Offline stand-ins used only when GEMINI_API_KEY is not set. Every response is flagged demo:true in the UI.
const SAMPLES = [
  { match: /bottle|pet|water|cold ?drink/i, item: 'PET drinking-water bottle', material: 'pet', resinCode: 1, recyclable: true, hazard: null, condition: 'needs_rinse', estWeightKg: 0.03, confidence: 0.94,
    steps: ['Empty and rinse the bottle', 'Remove the cap and label; caps are PP (5)', 'Crush flat to save space'], upcycle: ['Self-watering herb planter', 'Bird feeder for your balcony'], funFact: 'Five recycled PET bottles make enough fibre for one T-shirt.' },
  { match: /can|alumin|soda/i, item: 'Aluminium soft-drink can', material: 'aluminium', resinCode: null, recyclable: true, hazard: null, condition: 'clean', estWeightKg: 0.015, confidence: 0.91,
    steps: ['Rinse out any sugar', 'Crush lightly, keep the tab on', 'Collect 60+ cans for one kg'], upcycle: ['Desk pen stand', 'Tea-light lantern'], funFact: 'A recycled can can be back on the shelf in about 60 days.' },
  { match: /paper|news|book|akhbaar/i, item: 'Newspaper bundle', material: 'paper', resinCode: null, recyclable: true, hazard: null, condition: 'clean', estWeightKg: 1.2, confidence: 0.89,
    steps: ['Keep it dry', 'Tie in bundles of 5 kg', 'Remove plastic inserts'], upcycle: ['Papier-mâché bowl', 'Seed-starting pots'], funFact: 'Paper fibre can be recycled 5 to 7 times.' },
  { match: /phone|laptop|charger|cable|battery|e-?waste/i, item: 'Old mobile charger', material: 'e_waste', resinCode: null, recyclable: true, hazard: 'Contains metals; give to an authorised e-waste collector, not the dry bin.', condition: 'clean', estWeightKg: 0.12, confidence: 0.86,
    steps: ['Do not throw in household bins', 'Wrap loose cable ends', 'Drop at an authorised e-waste centre'], upcycle: ['Cable organiser art', 'Keep spare parts for repair cafés'], funFact: 'One tonne of phones holds more gold than one tonne of gold ore.' },
  { match: /box|carton|cardboard/i, item: 'Corrugated cardboard box', material: 'cardboard', resinCode: null, recyclable: true, hazard: null, condition: 'clean', estWeightKg: 0.4, confidence: 0.92,
    steps: ['Remove tape and stickers', 'Flatten the box', 'Keep away from rain'], upcycle: ['Drawer organiser', 'Cat scratch pad'], funFact: 'Recycling one tonne of cardboard saves around 17 trees.' },
];
export function demoScan(hint = '') {
  const pick = SAMPLES.find((s) => s.match.test(hint)) || SAMPLES[Math.floor(Math.random() * SAMPLES.length)];
  const { match, ...r } = pick; return { ...r };
}
export function demoChat(q = '') {
  if (/battery|e-?waste|phone|laptop/i.test(q)) return 'E-waste never goes in the dry bin. Under India\'s E-Waste Rules, give it to an authorised recycler or a brand take-back point. Open the Map tab and filter "E-waste" to find the nearest one.';
  if (/rate|price|kitna|kya bhav/i.test(q)) return 'Typical rates right now: newspaper ₹12–15/kg, cardboard ₹8–11/kg, PET bottles ₹18–25/kg, aluminium cans ₹100–120/kg. Scan an item to see an estimate for your exact item.';
  if (/plastic|bag|polythene/i.test(q)) return 'Thin carry bags (LDPE 4) are hard to recycle. Collect them clean and dry in one bag, and hand them to a dry-waste collector. Bottles marked 1 or 2 are worth the most.';
  if (/compost|wet|food|organic/i.test(q)) return 'Wet waste is great for compost: mix kitchen scraps with dry leaves 1:2, keep it moist, turn it every week. You\'ll have compost in about 6 weeks.';
  return 'I can help you sort waste, check scrap prices, find recycling hubs or plan a pickup. Try "Where do I throw old batteries?" or "Akhbaar ka rate kya hai?" (Demo answer: add a Gemini key for full AI replies.)';
}
export function demoUpcycle(item) {
  return { ideas: [
    { title: `${item} desk organiser`, time: '30 min', steps: ['Clean and dry the item', 'Cut to the height you need', 'Decorate with paint or washi tape'] },
    { title: `${item} planter`, time: '20 min', steps: ['Poke drainage holes', 'Fill with soil and a seedling', 'Place in indirect sunlight'] },
    { title: `${item} lamp shade`, time: '45 min', steps: ['Cut a pattern of small holes', 'Fit around a warm LED bulb', 'Hang with a fabric cord'] },
  ], image: null };
}
export function demoParse(text) {
  const kg = Number((text.match(/(\d+(?:\.\d+)?)\s*(kg|kilo|किलो)/i) || [])[1]) || 2;
  const map = [[/akhbaar|news|paper|अखबार/i, 'paper'], [/gatta|carton|box|cardboard/i, 'cardboard'], [/bottle|botal|बोतल/i, 'pet'], [/can|alumin/i, 'aluminium'], [/loha|iron|steel|लोहा/i, 'steel'], [/copper|tamba/i, 'copper'], [/kapde|clothes|कपड़े/i, 'textile'], [/phone|laptop|e-?waste/i, 'e_waste']];
  const material = (map.find(([re]) => re.test(text)) || [, 'other'])[1];
  return { title: text.slice(0, 60), material, kg, notes: '' };
}

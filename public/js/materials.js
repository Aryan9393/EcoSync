// Material knowledge used by the on-device scanner (no server or key needed).
export const INFO = {
  pet: { resin: 1, kg: 0.03, steps: ['Empty and rinse it', 'Remove the cap and label (caps are type 5)', 'Crush it flat to save space'], fact: 'About 25 PET bottles become enough fibre for one fleece jacket.' },
  hdpe: { resin: 2, kg: 0.1, steps: ['Rinse out any milk, oil or shampoo', 'Keep the cap on', 'Stack them inside each other'], fact: 'HDPE is often recycled into pipes, benches and new bottles.' },
  ldpe: { resin: 4, kg: 0.01, steps: ['Shake out crumbs and water', 'Collect thin bags inside one bag', 'Give them to a dry-waste collector'], fact: 'Clean plastic film can be turned into plastic lumber and roads.' },
  pp: { resin: 5, kg: 0.05, steps: ['Rinse food containers', 'Stack lids and boxes together', 'Keep them out of the wet bin'], fact: 'Bottle caps and takeaway boxes are usually PP.' },
  ps: { resin: 6, kg: 0.02, steps: ['Wipe off food', 'Break into flat pieces', 'Bag it separately; few collectors take it'], fact: 'Thermocol is 98% air, which makes it costly to transport for recycling.' },
  mixed_plastic: { resin: 7, kg: 0.05, steps: ['Rinse and dry', 'Keep it separate from bottles', 'Hand it to a dry-waste collector'], fact: 'Sorting plastics by their number roughly doubles what they sell for.' },
  aluminium: { resin: null, kg: 0.015, steps: ['Rinse out the sugar', 'Crush lightly, keep the ring-pull on', 'About 65 cans make one kilo'], fact: 'Recycling aluminium uses 95% less energy than making it new.' },
  steel: { resin: null, kg: 0.5, steps: ['Keep metals separate from plastic', 'Remove plastic handles if you can', 'Watch for sharp edges'], fact: 'Steel can be recycled endlessly without losing strength.' },
  copper: { resin: null, kg: 0.2, steps: ['Strip the plastic coating if easy', 'Bundle wire with a twist tie', 'Sell it separately, it is valuable'], fact: 'Copper is one of the most valuable things in household scrap.' },
  glass: { resin: null, kg: 0.3, steps: ['Rinse and remove lids', 'Keep it separate and unbroken', 'Wrap broken glass in newspaper'], fact: 'Glass can be recycled again and again with no loss in quality.' },
  paper: { resin: null, kg: 0.2, steps: ['Keep it dry', 'Remove plastic covers and inserts', 'Tie in 5 kg bundles'], fact: 'Paper fibres can be recycled 5 to 7 times.' },
  cardboard: { resin: null, kg: 0.4, steps: ['Remove tape and stickers', 'Flatten the box', 'Keep it away from rain'], fact: 'One tonne of recycled cardboard saves about 17 trees.' },
  e_waste: { resin: null, kg: 0.3, hazard: 'This is e-waste. Don\'t put it in household bins; take it to an authorised e-waste collector.', steps: ['Wipe any personal data', 'Remove batteries and keep them apart', 'Take it to an e-waste drop-off'], fact: 'A tonne of old phones holds more gold than a tonne of gold ore.' },
  battery: { resin: null, kg: 0.05, hazard: 'Batteries can leak or catch fire. Tape the ends and keep them out of every bin.', steps: ['Tape the terminals', 'Store in a dry box', 'Drop at an e-waste point or battery shop'], fact: 'Lead-acid batteries are among the most recycled products in India.' },
  textile: { resin: null, kg: 0.3, steps: ['Donate anything still wearable', 'Keep fabric dry and clean', 'Worn-out cotton sells as rags'], fact: 'Old cotton becomes cleaning rags, insulation and paper.' },
  organic: { resin: null, kg: 0.2, recyclable: false, steps: ['Put it in the wet (green) bin', 'Or compost it with dry leaves', 'Keep it out of dry waste'], fact: 'Kitchen waste turns into compost in about 6 weeks.' },
  other: { resin: null, kg: 0.2, steps: ['Check if it is clean and dry', 'Ask EcoBot how to dispose of it', 'Or give it to a dry-waste collector'], fact: 'When in doubt, keep it clean and separate.' },
};

// ImageNet labels (MobileNet) → EcoSync material, matched on the exact first name of each class.
const GROUPS = {
  pet: ['Plastic bottle', 'water bottle, pop bottle, water jug'],
  hdpe: ['Plastic container', 'pill bottle, lotion, soap dispenser, bucket, milk can, washbasin, plunger'],
  ldpe: ['Plastic bag or film', 'plastic bag, shower cap, packet'],
  glass: ['Glass bottle or jar', 'beer bottle, wine bottle, whiskey jug, beer glass, goblet, vase, perfume, measuring cup, cocktail shaker, red wine'],
  aluminium: ['Metal can or foil', 'can opener'],
  steel: ['Metal item', 'caldron, frying pan, wok, Dutch oven, pot, Crock Pot, teapot, coffeepot, ladle, strainer, spatula, tray, nail, screw, padlock, safety pin, chain, corkscrew, screwdriver, waffle iron, hammer, plane, wrench'],
  e_waste: ['Electronic item', 'cellular telephone, dial telephone, pay-phone, iPod, laptop, notebook, desktop computer, monitor, screen, computer keyboard, typewriter keyboard, mouse, remote control, modem, hard disc, printer, television, radio, loudspeaker, joystick, hand-held computer, digital clock, digital watch, electric fan, hand blower, microwave, toaster, switch, power drill, cassette, cassette player, CD player, projector, space heater, vacuum, iron, electric guitar, lighter, tape player'],
  battery: ['Battery', 'battery'],
  cardboard: ['Cardboard box', 'carton, crate, pencil box, envelope'],
  paper: ['Paper or book', 'comic book, book jacket, menu, crossword puzzle, paper towel, toilet tissue, binder, newspaper'],
  textile: ['Clothing or fabric', 'jersey, sweatshirt, jean, cardigan, sock, running shoe, sandal, Loafer, cowboy boot, wool, velvet, apron, bath towel, dishrag, pajama, fur coat, lab coat, trench coat, miniskirt, suit, kimono, bib, cloak, poncho, stole, sarong, abaya, overskirt, sleeping bag, quilt, handkerchief, mitten, bow tie, cowboy hat, sombrero, backpack, purse'],
  organic: ['Food or garden waste', 'banana, orange, lemon, pineapple, strawberry, pomegranate, cucumber, head cabbage, broccoli, cauliflower, corn, ear, mushroom, bell pepper, zucchini, spaghetti squash, acorn squash, butternut squash, artichoke, fig, Granny Smith, jackfruit, custard apple, acorn, hay, pizza, bagel, pretzel, French loaf, guacamole, potpie, burrito, meat loaf, ice cream, hotdog, cheeseburger, mashed potato, carbonara, trifle, consomme, plate'],
};
const LOOKUP = new Map();
for (const [mat, [item, names]] of Object.entries(GROUPS)) names.split(', ').forEach((n) => LOOKUP.set(n.toLowerCase(), { material: mat, item }));
export function labelToMaterial(label) { return LOOKUP.get(String(label).split(',')[0].trim().toLowerCase()) || null; }

// Loads MobileNet in the browser on first use (no key, no server).
// Tries TF Hub first, then Google's classic model bucket as a fallback.
let modelP = null;
const add = (src) => new Promise((res, rej) => { if ([...document.scripts].some((s) => s.src === src)) return res(); const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.append(s); });
export function loadModel() {
  if (!modelP) {
    modelP = (async () => {
      await add('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js');
      try {
        await add('https://cdn.jsdelivr.net/npm/@tensorflow-models/mobilenet@2.1.1/dist/mobilenet.min.js');
        const m = await window.mobilenet.load({ version: 1, alpha: 1.0 });
        return { classify: (img, k) => m.classify(img, k) };
      } catch {
        const tf = window.tf, { CLASSES } = await import('./imagenet.js');
        const net = await tf.loadLayersModel('https://storage.googleapis.com/tfjs-models/tfjs/mobilenet_v1_0.25_224/model.json');
        return {
          async classify(img, k = 5) {
            const logits = tf.tidy(() => net.predict(tf.browser.fromPixels(img).resizeBilinear([224, 224]).toFloat().div(127.5).sub(1).expandDims()));
            const vals = await logits.data(); logits.dispose();
            return [...vals].map((p, i) => ({ className: CLASSES[i], probability: p })).sort((a, b) => b.probability - a.probability).slice(0, k);
          },
        };
      }
    })().catch((e) => { modelP = null; throw e; });
  }
  return modelP;
}
export async function classify(imgEl) {
  const model = await loadModel();
  const preds = await model.classify(imgEl, 5);
  for (const p of preds) { const m = labelToMaterial(p.className); if (m) return { ...m, label: p.className.split(',')[0], confidence: p.probability, preds }; }
  return { material: null, item: preds[0]?.className.split(',')[0] || 'Unknown item', label: preds[0]?.className.split(',')[0], confidence: preds[0]?.probability || 0, preds };
}

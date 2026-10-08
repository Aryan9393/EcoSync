// Indicative scrap rates (₹/kg) for Indian cities. Edit these to match your local kabadiwala rates.
export const PRICES = {
  paper:         { label: 'Newspaper & paper', rate: 14, color: '#c8a46a', bin: 'Dry' },
  cardboard:     { label: 'Cardboard',          rate: 10, color: '#a87d4f', bin: 'Dry' },
  pet:           { label: 'PET bottles (1)',    rate: 22, color: '#38bdf8', bin: 'Dry' },
  hdpe:          { label: 'HDPE plastic (2)',   rate: 26, color: '#60a5fa', bin: 'Dry' },
  ldpe:          { label: 'LDPE film (4)',      rate: 8,  color: '#93c5fd', bin: 'Dry' },
  pp:            { label: 'PP plastic (5)',     rate: 18, color: '#818cf8', bin: 'Dry' },
  ps:            { label: 'Polystyrene (6)',    rate: 4,  color: '#a5b4fc', bin: 'Dry' },
  mixed_plastic: { label: 'Mixed plastic',      rate: 9,  color: '#7dd3fc', bin: 'Dry' },
  aluminium:     { label: 'Aluminium cans',     rate: 110, color: '#cbd5e1', bin: 'Dry' },
  steel:         { label: 'Iron & steel',       rate: 32, color: '#94a3b8', bin: 'Dry' },
  copper:        { label: 'Copper wire',        rate: 560, color: '#f59e0b', bin: 'Dry' },
  glass:         { label: 'Glass bottles',      rate: 3,  color: '#34d399', bin: 'Dry' },
  e_waste:       { label: 'E-waste',            rate: 45, color: '#f472b6', bin: 'E-waste' },
  battery:       { label: 'Batteries',          rate: 0,  color: '#ef4444', bin: 'Hazardous' },
  textile:       { label: 'Old clothes',        rate: 8,  color: '#c084fc', bin: 'Dry' },
  organic:       { label: 'Organic / food',     rate: 0,  color: '#84cc16', bin: 'Wet' },
  other:         { label: 'Other',              rate: 2,  color: '#a1a1aa', bin: 'Dry' },
};
// kg CO2e avoided per kg recycled vs. landfill (rounded from EPA WARM / EU averages).
export const CO2_PER_KG = { paper: 0.9, cardboard: 0.9, pet: 1.5, hdpe: 1.4, ldpe: 1.1, pp: 1.3, ps: 1.0, mixed_plastic: 1.0, aluminium: 9.1, steel: 1.8, copper: 3.5, glass: 0.3, e_waste: 2.0, battery: 1.0, textile: 3.2, organic: 0.2, other: 0.3 };
const ALIASES = { aluminum: 'aluminium', plastic: 'mixed_plastic', metal: 'steel', iron: 'steel', newspaper: 'paper', ewaste: 'e_waste', 'e-waste': 'e_waste', clothes: 'textile', food: 'organic', bottle: 'pet' };
export function materialKey(m) {
  const k = String(m || 'other').toLowerCase().trim().replace(/\s+/g, '_');
  return PRICES[k] ? k : ALIASES[k] || 'other';
}

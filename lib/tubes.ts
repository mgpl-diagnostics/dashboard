// The dashboard's one signature detail: a sample type is shown with the cap colour of its tube, the
// colour phlebotomists and technicians already read at the bench (the usual order-of-draw colours).
// Anything unknown gets a neutral cap.

export interface Tube { cap: string; label: string }

const RULES: [RegExp, Tube][] = [
  [/edta|whole blood/i, { cap: "#8e6bbf", label: "Lavender cap (EDTA)" }],
  [/citrate/i, { cap: "#5ba4d9", label: "Light blue cap (citrate)" }],
  [/fluoride|oxalate/i, { cap: "#8a8f98", label: "Grey cap (fluoride)" }],
  [/heparin/i, { cap: "#2e8b57", label: "Green cap (heparin)" }],
  [/serum|sst|clot/i, { cap: "#d4a017", label: "Gold cap (serum)" }],
  [/urine/i, { cap: "#e3c230", label: "Urine container" }],
  [/stool|faec|fec/i, { cap: "#8b6f4e", label: "Stool container" }],
  [/swab|sputum|culture|csf|fluid/i, { cap: "#c94f4f", label: "Sterile container" }],
];

export function tubeFor(sampleType: string | null | undefined): Tube {
  if (!sampleType) return { cap: "#a1a1a6", label: "Sample type not set" };
  for (const [re, t] of RULES) if (re.test(sampleType)) return t;
  return { cap: "#a1a1a6", label: sampleType };
}

// Dátumkezelés budapesti idő szerint.

/** Mai dátum ÉÉÉÉ-HH-NN alakban, Europe/Budapest időzónában. */
export function todayBudapest(now = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Budapest" }).format(now);
}

/** ÉÉÉÉ-HH-NN → ÉÉÉÉ-HH */
export const periodOf = (date) => String(date).slice(0, 7);

/** Következő hónap: 2026-12 → 2027-01 */
export function nextPeriod(period) {
  let [y, m] = period.split("-").map(Number);
  m++;
  if (m > 12) { m = 1; y++; }
  return `${y}-${String(m).padStart(2, "0")}`;
}

/** Hónapok listája a két időszak között (mindkettőt beleértve). */
export function periodsBetween(from, to) {
  const out = [];
  for (let p = from; p <= to; p = nextPeriod(p)) out.push(p);
  return out;
}

/** A hónap utolsó napja (1–31). */
export function daysInMonth(period) {
  const [y, m] = period.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

const HU_MONTHS = ["január", "február", "március", "április", "május", "június", "július",
  "augusztus", "szeptember", "október", "november", "december"];

/** 2026-11 → „2026. november” */
export function periodLabel(period) {
  const [y, m] = String(period).split("-").map(Number);
  return HU_MONTHS[m - 1] ? `${y}. ${HU_MONTHS[m - 1]}` : String(period);
}

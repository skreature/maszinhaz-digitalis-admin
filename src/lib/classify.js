// Szabályalapú címkejavaslat („classifier”). Átlátható, bővíthető szabályok; a címke mindig csak javaslat.
import { stripAccents } from "./normalize.js";

export const KNOWN_TAGS = ["sajtó", "partner", "támogató", "tag", "néző", "egyéb"];

const plain = (s) => stripAccents(s).toLowerCase();

// [címke, mire illeszkedik, hol keressük]
const RULES = [
  ["sajtó", /sajto|press|media/, "file"],
  ["partner", /partner/, "file"],
  ["támogató", /tamogat|szponzor|mecenas/, "file"],
  ["tag", /^tagok|tagsag|tagnyilvantartas/, "file"],
  ["néző", /hirlevel|newsletter|nezo|jegyvasarlo/, "file"],
  ["sajtó", /szerkesztoseg|ujsag|hirlap|magazin|radio|televizio|\btv\b|portal|hirado|napilap|\bmedia\b/, "org"],
  ["partner", /onkormanyzat|polgarmesteri|iskola|gimnazium|ovoda|egyetem|muvelodesi|kozosseg|alapitvany|egyesulet|konyvtar|szinhaz/, "org"],
  ["támogató", /tamogato|szponzor|mecenas/, "org"],
  ["partner", /onkormanyzat|polgarmester|\.gov\.hu$|\.edu\.hu$|iskola|suli|ovi|alapitvany|egyesulet|muvhaz|konyvtar/, "domain"],
  // a domain szavait (pont és kötőjel mentén) vizsgáljuk, hogy pl. „alapitvany” ne illeszkedjen a „tv”-re
  ["sajtó", /(^|[.-])(hirek|news|ujsag|naplo|magazin|radio|tv|media|press|szerkesztoseg)([.-]|$)/, "domain"],
];

/**
 * Címkejavaslat egy sorhoz.
 * @param {{filename?: string, org?: string, email?: string, isMember?: boolean}} input
 * @returns {string[]} rendezett, ismétlés nélküli címkelista
 */
export function suggestTags({ filename = "", org = "", email = "", isMember = false }) {
  const file = plain(filename);
  const o = plain(org);
  const domain = plain(String(email).split("@")[1] ?? "");
  const out = new Set();
  for (const [tag, re, where] of RULES) {
    const text = where === "file" ? file : where === "org" ? o : domain;
    if (text && re.test(text)) out.add(tag);
  }
  if (isMember) out.add("tag");
  return [...out].sort();
}

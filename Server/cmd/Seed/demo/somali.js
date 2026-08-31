/**
 * Somali name / place / contact pools and helpers for the demo seed.
 * Names use common Somali Latin-script spellings.
 */

import { pick, int, chance } from "./rng.js";

export const MALE_FIRST_NAMES = [
  "Maxamed", "Cabdi", "Cali", "Xasan", "Xuseen", "Ibraahim", "Yuusuf", "Cabdullahi",
  "Axmed", "Maxamuud", "Nuur", "Cumar", "Bashiir", "Faarax", "Daahir", "Ismaaciil",
  "Guuleed", "Warsame", "Siyaad", "Liibaan", "Kaahiye", "Diriye", "Jaamac", "Rooble",
  "Xirsi", "Cabdiraxmaan", "Maxamed Nuur", "Cabdiqaadir", "Saciid", "Deeq", "Barre",
  "Muuse", "Cawil", "Gaani", "Yaasiin", "Aweys", "Cabdifataax", "Khaliil",
];

export const FEMALE_FIRST_NAMES = [
  "Fadumo", "Hodan", "Aamina", "Ubax", "Deeqa", "Sahra", "Xaliimo", "Ifraax",
  "Naima", "Faiza", "Ayaan", "Ladan", "Khadiija", "Ruqiya", "Shukri", "Maryan",
  "Zamzam", "Nasteexo", "Canab", "Hibaaq", "Saynab", "Warsan", "Idil", "Haani",
  "Aisha", "Muno", "Filsan", "Sagal", "Ridwaan", "Basra", "Qamar", "Xamdi",
  "Rahma", "Fartuun", "Nadifa", "Suad", "Hani", "Amal",
];

/** Patronymic / grandfather names — used for lastName and, doubled, for middle. */
export const FAMILY_NAMES = [
  "Maxamed", "Cabdi", "Xasan", "Cali", "Xuseen", "Ibraahim", "Yuusuf", "Axmed",
  "Cabdullahi", "Nuur", "Cumar", "Warsame", "Faarax", "Jaamac", "Rooble", "Diriye",
  "Aadan", "Geele", "Xirsi", "Ismaaciil", "Guuleed", "Boqor", "Gaani", "Cawil",
  "Sheekh", "Cabdiraxmaan", "Kaariye", "Xaaji", "Maxamuud", "Daahir", "Barre",
  "Ciise", "Gedi", "Elmi", "Afrax", "Diini", "Tarabi", "Osoble",
];

export const CITIES = [
  "Muqdisho", "Hargeysa", "Boosaaso", "Kismaayo", "Garoowe", "Beledweyne",
  "Baydhabo", "Gaalkacyo", "Berbera", "Burco", "Jowhar", "Marka", "Afgooye",
  "Laascaanood", "Boorama", "Qardho", "Ceerigaabo", "Dhuusamareeb", "Xudur", "Gebiley",
];

export const DISTRICTS = [
  "Hodan", "Waberi", "Xamar Weyne", "Kaaraan", "Yaaqshiid", "Wadajir", "Dharkenley",
  "Shibis", "Bondhere", "Hamar Jajab", "Heliwaa", "Deynile",
];

export const RELATIONS = [
  "Husband", "Wife", "Father", "Mother", "Son", "Daughter",
  "Brother", "Sister", "Uncle", "Aunt", "Nephew", "Niece", "Guardian",
];

/** Agency name building blocks. */
const AGENCY_WORDS = [
  "Barwaaqo", "Hilaac", "Deeqa", "Nabad", "Horyaal", "Kaah", "Rajo", "Danab",
  "Caafimaad", "Wadajir", "Hormuud", "Geeska", "Shaqodoon", "Ifiye", "Saxansaxo",
  "Toosle", "Midnimo", "Guuleed", "Xarumo", "Dib-u-heshiisiin",
];
const AGENCY_SUFFIXES = [
  "Medical Travel", "Referral Services", "Health Bridge", "Medical Agency",
  "Travel & Health", "Medical Referrals", "Medical Tourism", "Health Partners",
  "Healthcare Facilitators", "Medical Assistance",
];

export function agencyName(i) {
  const w = AGENCY_WORDS[i % AGENCY_WORDS.length];
  const s = AGENCY_SUFFIXES[Math.floor(i / AGENCY_WORDS.length) % AGENCY_SUFFIXES.length];
  // A handful of "Al-" prefixed names for variety.
  return i % 5 === 0 ? `Al-${w} ${s}` : `${w} ${s}`;
}

export function fullName(gender) {
  const first = gender === "FEMALE" ? pick(FEMALE_FIRST_NAMES) : pick(MALE_FIRST_NAMES);
  const middle = pick(FAMILY_NAMES);
  const last = pick(FAMILY_NAMES);
  return { firstName: `${first} ${middle}`, lastName: last, first, middle, last };
}

export function somaliPhone() {
  // Hormuud 61x / 90x, Somtel 65x, Telesom (Somaliland) 63x
  const prefix = pick(["61", "62", "63", "65", "68", "90"]);
  const rest = String(int(1000000, 9999999));
  return `+252 ${prefix} ${rest.slice(0, 3)} ${rest.slice(3)}`;
}

export function streetAddress() {
  const city = pick(CITIES);
  const district = city === "Muqdisho" && chance(0.7) ? `${pick(DISTRICTS)} District, ` : "";
  return `${district}${city}, Somalia`;
}

export function emailFor(first, last, domain = "asterreferral.com") {
  const clean = (s) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[^a-z]/g, "");
  return `${clean(first)}.${clean(last)}@${domain}`;
}

export function passportNumber() {
  // Somali passports: a letter then 7 digits.
  return `${pick(["P", "N", "C"])}${int(1000000, 9999999)}`;
}

export const NATIONALITY = "Somali";

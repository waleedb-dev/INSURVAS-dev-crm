/**
 * Geographic taxonomy for BPO centres and centre leads (aligned with centre CRUD dropdowns).
 */
export const BPO_REGIONS = [
  "North America",
  "South America",
  "Central America",
  "Caribbean",
  "Europe",
  "Middle East",
  "Africa",
  "Asia",
  "Oceania",
] as const;

export type BpoRegionKey = (typeof BPO_REGIONS)[number];

export const BPO_COUNTRIES_BY_REGION: Record<BpoRegionKey, string[]> = {
  "North America": ["United States", "Canada", "Mexico"],
  "South America": [
    "Brazil",
    "Argentina",
    "Colombia",
    "Peru",
    "Chile",
    "Venezuela",
    "Ecuador",
    "Bolivia",
    "Paraguay",
    "Uruguay",
    "Guyana",
    "Suriname",
    "French Guiana",
  ],
  "Central America": [
    "Guatemala",
    "Belize",
    "Honduras",
    "El Salvador",
    "Nicaragua",
    "Costa Rica",
    "Panama",
  ],
  "Caribbean": [
    "Dominican Republic",
    "Cuba",
    "Jamaica",
    "Puerto Rico",
    "Trinidad and Tobago",
    "Bahamas",
    "Barbados",
    "Haiti",
  ],
  Europe: [
    "United Kingdom",
    "Spain",
    "Germany",
    "France",
    "Italy",
    "Portugal",
    "Poland",
    "Romania",
    "Netherlands",
    "Belgium",
    "Sweden",
    "Austria",
    "Switzerland",
    "Greece",
    "Czech Republic",
    "Hungary",
    "Denmark",
    "Finland",
    "Norway",
    "Ireland",
    "Slovakia",
    "Bulgaria",
    "Croatia",
    "Serbia",
    "Slovenia",
    "Lithuania",
    "Latvia",
    "Estonia",
    "Luxembourg",
    "Malta",
    "Cyprus",
  ],
  "Middle East": [
    "Saudi Arabia",
    "United Arab Emirates",
    "Israel",
    "Turkey",
    "Egypt",
    "Qatar",
    "Kuwait",
    "Bahrain",
    "Oman",
    "Jordan",
    "Lebanon",
    "Iraq",
    "Iran",
  ],
  Africa: [
    "Nigeria",
    "South Africa",
    "Kenya",
    "Ghana",
    "Egypt",
    "Morocco",
    "Tanzania",
    "Uganda",
    "Ethiopia",
    "Algeria",
    "Cameroon",
    "Senegal",
    "Ivory Coast",
    "Tunisia",
    "Libya",
    "Sudan",
    "Angola",
    "Mozambique",
    "Madagascar",
    "Zimbabwe",
  ],
  Asia: [
    "India",
    "Pakistan",
    "Philippines",
    "Bangladesh",
    "Sri Lanka",
    "Nepal",
    "Indonesia",
    "Thailand",
    "Vietnam",
    "Malaysia",
    "Singapore",
    "China",
    "Hong Kong",
    "Taiwan",
    "Japan",
    "South Korea",
    "Myanmar",
    "Cambodia",
    "Laos",
    "Mongolia",
  ],
  Oceania: [
    "Australia",
    "New Zealand",
    "Fiji",
    "Papua New Guinea",
    "Samoa",
    "Tonga",
    "Vanuatu",
    "Solomon Islands",
  ],
};

export function countriesForBpoRegion(region: string | null | undefined): string[] {
  if (!region || !(region in BPO_COUNTRIES_BY_REGION)) return [];
  return BPO_COUNTRIES_BY_REGION[region as BpoRegionKey];
}

export function regionIsListed(region: string | null | undefined): boolean {
  if (!region) return false;
  return (BPO_REGIONS as readonly string[]).includes(region);
}

export function countryIsListedForRegion(
  region: string | null | undefined,
  country: string | null | undefined,
): boolean {
  if (!region || !country) return false;
  return countriesForBpoRegion(region).includes(country);
}

/** De-duplicated, sorted catalogue for centre-lead intake (country only; no region in UI). */
export const ALL_BPO_COUNTRIES_SORTED = (() => {
  const uniq = new Set<string>();
  for (const groups of Object.values(BPO_COUNTRIES_BY_REGION)) {
    for (const c of groups) uniq.add(c);
  }
  return Array.from(uniq).sort((a, b) => a.localeCompare(b, "en"));
})();

/** True if country appears in our standard list (canonical spelling). */
export function isKnownBpoCountry(country: string | null | undefined): boolean {
  if (!country?.trim()) return false;
  return ALL_BPO_COUNTRIES_SORTED.includes(country.trim());
}

/** Infer region tab for downstream call_centers linkage (first taxonomy match wins). */
export function bpoRegionForCountry(country: string | null | undefined): string | null {
  const c = country?.trim();
  if (!c) return null;
  for (const [regKey, list] of Object.entries(BPO_COUNTRIES_BY_REGION) as [BpoRegionKey, string[]][]) {
    if (list.includes(c)) return regKey;
  }
  return null;
}

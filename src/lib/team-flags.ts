// FIFA 3-letter code → ISO 3166-1 alpha-2 for flagcdn.com
export const FIFA_TO_ISO2: Record<string, string> = {
  ALG: "dz", ARG: "ar", AUS: "au", AUT: "at", BEL: "be", BIH: "ba",
  BRA: "br", CAN: "ca", CIV: "ci", COD: "cd", COL: "co", CPV: "cv",
  CRO: "hr", CUW: "cw", CZE: "cz", ECU: "ec", EGY: "eg", ENG: "gb-eng",
  ESP: "es", FRA: "fr", GER: "de", GHA: "gh", HAI: "ht", IRN: "ir",
  IRQ: "iq", JOR: "jo", JPN: "jp", KOR: "kr", KSA: "sa", MAR: "ma",
  MEX: "mx", NED: "nl", NOR: "no", NZL: "nz", PAN: "pa", PAR: "py",
  POR: "pt", QAT: "qa", RSA: "za", SCO: "gb-sct", SEN: "sn", SUI: "ch",
  SWE: "se", TUN: "tn", TUR: "tr", URU: "uy", USA: "us", UZB: "uz",
};

export function flagUrl(code?: string | null, size: 40 | 80 = 40): string | null {
  if (!code) return null;
  const iso = FIFA_TO_ISO2[code.toUpperCase()];
  if (!iso) return null;
  return `https://flagcdn.com/w${size}/${iso}.png`;
}
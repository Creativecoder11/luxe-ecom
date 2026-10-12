/**
 * Bangladesh divisions and districts (8 / 64). District codes drive delivery zones and COD
 * eligibility (D-029–D-031). Upazila/thana is free text until courier integrations need codes.
 */
export interface District {
  code: string;
  name: string;
  division: string;
}

const DATA: Record<string, string[]> = {
  Barishal: ["Barguna", "Barishal", "Bhola", "Jhalokati", "Patuakhali", "Pirojpur"],
  Chattogram: ["Bandarban", "Brahmanbaria", "Chandpur", "Chattogram", "Cox's Bazar", "Cumilla", "Feni", "Khagrachhari", "Lakshmipur", "Noakhali", "Rangamati"],
  Dhaka: ["Dhaka", "Faridpur", "Gazipur", "Gopalganj", "Kishoreganj", "Madaripur", "Manikganj", "Munshiganj", "Narayanganj", "Narsingdi", "Rajbari", "Shariatpur", "Tangail"],
  Khulna: ["Bagerhat", "Chuadanga", "Jashore", "Jhenaidah", "Khulna", "Kushtia", "Magura", "Meherpur", "Narail", "Satkhira"],
  Mymensingh: ["Jamalpur", "Mymensingh", "Netrokona", "Sherpur"],
  Rajshahi: ["Bogura", "Chapai Nawabganj", "Joypurhat", "Naogaon", "Natore", "Pabna", "Rajshahi", "Sirajganj"],
  Rangpur: ["Dinajpur", "Gaibandha", "Kurigram", "Lalmonirhat", "Nilphamari", "Panchagarh", "Rangpur", "Thakurgaon"],
  Sylhet: ["Habiganj", "Moulvibazar", "Sunamganj", "Sylhet"],
};

function code(name: string): string {
  return name.toLowerCase().replace(/'/g, "").replace(/[^a-z0-9]+/g, "-");
}

export const DIVISIONS: readonly string[] = Object.keys(DATA);

export const DISTRICTS: readonly District[] = Object.entries(DATA).flatMap(([division, names]) =>
  names.map((name) => ({ code: code(name), name, division })),
);

const BY_CODE = new Map(DISTRICTS.map((d) => [d.code, d]));

export function findDistrict(districtCode: string): District | undefined {
  return BY_CODE.get(districtCode);
}

export function isDistrictCode(value: string): boolean {
  return BY_CODE.has(value);
}

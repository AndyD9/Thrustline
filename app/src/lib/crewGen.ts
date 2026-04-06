// Crew candidate generator — dynamic salaries based on rank, experience, market

const FIRST_NAMES = [
  "James", "Emma", "Liam", "Olivia", "Noah", "Ava", "Lucas", "Sophia",
  "Mason", "Isabella", "Ethan", "Mia", "Alexander", "Charlotte", "William",
  "Amelia", "Benjamin", "Harper", "Daniel", "Evelyn", "Henry", "Aria",
  "Sebastian", "Chloe", "Jack", "Ella", "Owen", "Scarlett", "Samuel", "Grace",
  "Pierre", "Marie", "Hans", "Ingrid", "Carlos", "Ana", "Kenji", "Yuki",
  "Ahmed", "Fatima", "Raj", "Priya", "Wei", "Lin", "Omar", "Leila",
  "Aleksei", "Natasha", "Marco", "Giulia", "Erik", "Astrid", "Tomas", "Elena",
];

const LAST_NAMES = [
  "Anderson", "Baker", "Campbell", "Davies", "Edwards", "Fisher", "Garcia",
  "Harris", "Jackson", "Kennedy", "Lambert", "Mitchell", "Nelson", "O'Brien",
  "Parker", "Quinn", "Roberts", "Smith", "Thompson", "Walker", "Young",
  "Müller", "Schmidt", "Dubois", "Martin", "Rossi", "Ferrari", "Silva",
  "Santos", "Tanaka", "Sato", "Kim", "Park", "Chen", "Wang", "Singh",
  "Johansson", "Larsen", "Petrov", "Kowalski", "Novak", "Fernandez", "Lopez",
];

export interface CrewCandidate {
  firstName: string;
  lastName: string;
  rank: "captain" | "first_officer";
  experience: number;
  salaryMo: number;
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Generate a realistic monthly salary based on rank and experience. */
export function generateSalary(rank: "captain" | "first_officer", experience: number): number {
  const base = rank === "captain" ? 12000 : 7000;
  const expBonus = base * experience * 0.02;
  const marketVar = base * (Math.random() * 0.2 - 0.1);
  return Math.round(base + expBonus + marketVar);
}

/** Generate a single crew candidate. */
export function generateCandidate(rank: "captain" | "first_officer"): CrewCandidate {
  const experience = rank === "captain" ? randInt(3, 25) : randInt(0, 15);
  return {
    firstName: pick(FIRST_NAMES),
    lastName: pick(LAST_NAMES),
    rank,
    experience,
    salaryMo: generateSalary(rank, experience),
  };
}

/** Generate a pool of candidates for hiring. */
export function generateCandidates(
  rank: "captain" | "first_officer",
  count = 4,
): CrewCandidate[] {
  const candidates: CrewCandidate[] = [];
  const usedNames = new Set<string>();
  while (candidates.length < count) {
    const c = generateCandidate(rank);
    const fullName = `${c.firstName} ${c.lastName}`;
    if (!usedNames.has(fullName)) {
      usedNames.add(fullName);
      candidates.push(c);
    }
  }
  return candidates.sort((a, b) => a.salaryMo - b.salaryMo);
}

/** Generate a crew pair (captain + FO) for a new aircraft. */
export function generateCrewForAircraft(): { captain: CrewCandidate; firstOfficer: CrewCandidate } {
  return {
    captain: generateCandidate("captain"),
    firstOfficer: generateCandidate("first_officer"),
  };
}

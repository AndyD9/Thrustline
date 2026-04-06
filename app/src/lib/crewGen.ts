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

export type CrewCandidateRank = "captain" | "first_officer" | "cabin_crew";

export interface CrewCandidate {
  firstName: string;
  lastName: string;
  rank: CrewCandidateRank;
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
export function generateSalary(rank: CrewCandidateRank, experience: number): number {
  const base = rank === "captain" ? 12000 : rank === "first_officer" ? 7000 : 3500;
  const expBonus = base * experience * 0.02;
  const marketVar = base * (Math.random() * 0.2 - 0.1);
  return Math.round(base + expBonus + marketVar);
}

/** Generate a single crew candidate. */
export function generateCandidate(rank: CrewCandidateRank): CrewCandidate {
  const experience = rank === "captain" ? randInt(3, 25) : rank === "first_officer" ? randInt(0, 15) : randInt(0, 20);
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
  rank: CrewCandidateRank,
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

/** Generate a full crew for an aircraft type. */
export function generateCrewForAircraft(minPilots: number, minCabin: number): CrewCandidate[] {
  const crew: CrewCandidate[] = [];
  // Always 1 captain
  crew.push(generateCandidate("captain"));
  // Remaining pilots as FOs
  for (let i = 1; i < minPilots; i++) crew.push(generateCandidate("first_officer"));
  // Cabin crew
  for (let i = 0; i < minCabin; i++) crew.push(generateCandidate("cabin_crew"));
  return crew;
}

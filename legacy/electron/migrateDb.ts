import Database from 'better-sqlite3'

/**
 * Ensures all tables exist in the SQLite database.
 * Uses IF NOT EXISTS so it's safe to run on every startup.
 */
export function ensureSchema(dbPath: string) {
  const db = new Database(dbPath)

  db.exec(`
    CREATE TABLE IF NOT EXISTS "Company" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "capital" REAL NOT NULL DEFAULT 1000000,
      "hubIcao" TEXT,
      "activeAircraftId" TEXT,
      "airlineCode" TEXT NOT NULL DEFAULT 'THL',
      "simbriefUsername" TEXT,
      "onboarded" BOOLEAN NOT NULL DEFAULT false,
      "userId" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      "syncedAt" DATETIME
    );

    CREATE TABLE IF NOT EXISTS "Loan" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "principal" REAL NOT NULL,
      "monthlyPayment" REAL NOT NULL,
      "remainingAmount" REAL NOT NULL,
      "totalMonths" INTEGER NOT NULL,
      "paidMonths" INTEGER NOT NULL DEFAULT 0,
      "interestRate" REAL NOT NULL,
      "companyId" TEXT NOT NULL,
      "userId" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      "syncedAt" DATETIME,
      CONSTRAINT "Loan_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
    );

    CREATE TABLE IF NOT EXISTS "Dispatch" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "flightNumber" TEXT NOT NULL,
      "originIcao" TEXT NOT NULL,
      "destIcao" TEXT NOT NULL,
      "icaoType" TEXT NOT NULL,
      "distanceNm" REAL NOT NULL,
      "ecoPax" INTEGER NOT NULL,
      "bizPax" INTEGER NOT NULL,
      "cargoKg" REAL NOT NULL,
      "estimFuelLbs" REAL NOT NULL,
      "cruiseAlt" INTEGER NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'pending',
      "ofpData" TEXT,
      "flightId" TEXT,
      "aircraftId" TEXT,
      "companyId" TEXT NOT NULL,
      "userId" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      "syncedAt" DATETIME,
      CONSTRAINT "Dispatch_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
    );

    CREATE TABLE IF NOT EXISTS "Aircraft" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "icaoType" TEXT NOT NULL,
      "healthPct" REAL NOT NULL DEFAULT 100,
      "leaseCostMo" REAL NOT NULL,
      "totalHours" REAL NOT NULL DEFAULT 0,
      "cycles" INTEGER NOT NULL DEFAULT 0,
      "ownership" TEXT NOT NULL DEFAULT 'leased',
      "purchasePrice" REAL,
      "purchasedAt" DATETIME,
      "companyId" TEXT NOT NULL,
      "userId" TEXT,
      "updatedAt" DATETIME NOT NULL,
      "syncedAt" DATETIME,
      CONSTRAINT "Aircraft_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
    );

    CREATE TABLE IF NOT EXISTS "Flight" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "departureIcao" TEXT NOT NULL,
      "arrivalIcao" TEXT NOT NULL,
      "durationMin" INTEGER NOT NULL,
      "fuelUsedGal" REAL NOT NULL,
      "distanceNm" REAL NOT NULL,
      "landingVsFpm" REAL NOT NULL,
      "revenue" REAL NOT NULL DEFAULT 0,
      "fuelCost" REAL NOT NULL DEFAULT 0,
      "landingFee" REAL NOT NULL DEFAULT 0,
      "netResult" REAL NOT NULL DEFAULT 0,
      "companyId" TEXT NOT NULL,
      "aircraftId" TEXT,
      "userId" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      "syncedAt" DATETIME,
      CONSTRAINT "Flight_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT "Flight_aircraftId_fkey" FOREIGN KEY ("aircraftId") REFERENCES "Aircraft" ("id") ON DELETE SET NULL ON UPDATE CASCADE
    );

    CREATE TABLE IF NOT EXISTS "Route" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "originIcao" TEXT NOT NULL,
      "destIcao" TEXT NOT NULL,
      "distanceNm" REAL NOT NULL,
      "basePrice" REAL NOT NULL,
      "active" BOOLEAN NOT NULL DEFAULT true,
      "companyId" TEXT NOT NULL,
      "userId" TEXT,
      "updatedAt" DATETIME NOT NULL,
      "syncedAt" DATETIME,
      CONSTRAINT "Route_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
    );

    CREATE TABLE IF NOT EXISTS "GameEvent" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "type" TEXT NOT NULL,
      "scope" TEXT NOT NULL,
      "targetId" TEXT,
      "title" TEXT NOT NULL,
      "description" TEXT NOT NULL,
      "modifier" REAL NOT NULL DEFAULT 1.0,
      "startsAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "expiresAt" DATETIME NOT NULL,
      "companyId" TEXT NOT NULL,
      "userId" TEXT,
      "updatedAt" DATETIME NOT NULL,
      "syncedAt" DATETIME,
      CONSTRAINT "GameEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
    );

    CREATE TABLE IF NOT EXISTS "Reputation" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "originIcao" TEXT NOT NULL,
      "destIcao" TEXT NOT NULL,
      "score" REAL NOT NULL DEFAULT 50,
      "flightCount" INTEGER NOT NULL DEFAULT 0,
      "companyId" TEXT NOT NULL,
      "userId" TEXT,
      "updatedAt" DATETIME NOT NULL,
      "syncedAt" DATETIME,
      CONSTRAINT "Reputation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
    );

    CREATE TABLE IF NOT EXISTS "CrewMember" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "firstName" TEXT NOT NULL,
      "lastName" TEXT NOT NULL,
      "rank" TEXT NOT NULL DEFAULT 'first_officer',
      "experience" INTEGER NOT NULL DEFAULT 1,
      "salaryMo" REAL NOT NULL,
      "dutyHours" REAL NOT NULL DEFAULT 0,
      "maxDutyH" REAL NOT NULL DEFAULT 80,
      "status" TEXT NOT NULL DEFAULT 'available',
      "aircraftId" TEXT,
      "companyId" TEXT NOT NULL,
      "hiredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "userId" TEXT,
      "updatedAt" DATETIME NOT NULL,
      "syncedAt" DATETIME,
      CONSTRAINT "CrewMember_aircraftId_fkey" FOREIGN KEY ("aircraftId") REFERENCES "Aircraft" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT "CrewMember_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
    );

    CREATE TABLE IF NOT EXISTS "Transaction" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "type" TEXT NOT NULL,
      "amount" REAL NOT NULL,
      "description" TEXT NOT NULL,
      "flightId" TEXT,
      "companyId" TEXT NOT NULL,
      "userId" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      "syncedAt" DATETIME
    );

    CREATE TABLE IF NOT EXISTS "SyncLog" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "tableName" TEXT NOT NULL,
      "recordId" TEXT NOT NULL,
      "action" TEXT NOT NULL,
      "payload" TEXT,
      "syncedAt" DATETIME,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE UNIQUE INDEX IF NOT EXISTS "Reputation_originIcao_destIcao_companyId_key" ON "Reputation"("originIcao", "destIcao", "companyId");
    CREATE INDEX IF NOT EXISTS "SyncLog_tableName_syncedAt_idx" ON "SyncLog"("tableName", "syncedAt");
  `)

  db.close()
}

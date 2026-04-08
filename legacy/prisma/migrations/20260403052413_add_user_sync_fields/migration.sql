/*
  Warnings:

  - Added the required column `updatedAt` to the `Aircraft` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Company` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `CrewMember` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Dispatch` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Flight` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `GameEvent` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Loan` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Reputation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Route` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Transaction` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "SyncLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tableName" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "payload" TEXT,
    "syncedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Aircraft" (
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
INSERT INTO "new_Aircraft" ("companyId", "cycles", "healthPct", "icaoType", "id", "leaseCostMo", "name", "ownership", "purchasePrice", "purchasedAt", "totalHours", "updatedAt") SELECT "companyId", "cycles", "healthPct", "icaoType", "id", "leaseCostMo", "name", "ownership", "purchasePrice", "purchasedAt", "totalHours", CURRENT_TIMESTAMP FROM "Aircraft";
DROP TABLE "Aircraft";
ALTER TABLE "new_Aircraft" RENAME TO "Aircraft";
CREATE TABLE "new_Company" (
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
INSERT INTO "new_Company" ("activeAircraftId", "airlineCode", "capital", "createdAt", "hubIcao", "id", "name", "onboarded", "simbriefUsername", "updatedAt") SELECT "activeAircraftId", "airlineCode", "capital", "createdAt", "hubIcao", "id", "name", "onboarded", "simbriefUsername", CURRENT_TIMESTAMP FROM "Company";
DROP TABLE "Company";
ALTER TABLE "new_Company" RENAME TO "Company";
CREATE TABLE "new_CrewMember" (
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
INSERT INTO "new_CrewMember" ("aircraftId", "companyId", "dutyHours", "experience", "firstName", "hiredAt", "id", "lastName", "maxDutyH", "rank", "salaryMo", "status", "updatedAt") SELECT "aircraftId", "companyId", "dutyHours", "experience", "firstName", "hiredAt", "id", "lastName", "maxDutyH", "rank", "salaryMo", "status", CURRENT_TIMESTAMP FROM "CrewMember";
DROP TABLE "CrewMember";
ALTER TABLE "new_CrewMember" RENAME TO "CrewMember";
CREATE TABLE "new_Dispatch" (
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
INSERT INTO "new_Dispatch" ("aircraftId", "bizPax", "cargoKg", "companyId", "createdAt", "cruiseAlt", "destIcao", "distanceNm", "ecoPax", "estimFuelLbs", "flightId", "flightNumber", "icaoType", "id", "ofpData", "originIcao", "status", "updatedAt") SELECT "aircraftId", "bizPax", "cargoKg", "companyId", "createdAt", "cruiseAlt", "destIcao", "distanceNm", "ecoPax", "estimFuelLbs", "flightId", "flightNumber", "icaoType", "id", "ofpData", "originIcao", "status", CURRENT_TIMESTAMP FROM "Dispatch";
DROP TABLE "Dispatch";
ALTER TABLE "new_Dispatch" RENAME TO "Dispatch";
CREATE TABLE "new_Flight" (
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
INSERT INTO "new_Flight" ("aircraftId", "arrivalIcao", "companyId", "createdAt", "departureIcao", "distanceNm", "durationMin", "fuelCost", "fuelUsedGal", "id", "landingFee", "landingVsFpm", "netResult", "revenue", "updatedAt") SELECT "aircraftId", "arrivalIcao", "companyId", "createdAt", "departureIcao", "distanceNm", "durationMin", "fuelCost", "fuelUsedGal", "id", "landingFee", "landingVsFpm", "netResult", "revenue", CURRENT_TIMESTAMP FROM "Flight";
DROP TABLE "Flight";
ALTER TABLE "new_Flight" RENAME TO "Flight";
CREATE TABLE "new_GameEvent" (
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
INSERT INTO "new_GameEvent" ("companyId", "description", "expiresAt", "id", "modifier", "scope", "startsAt", "targetId", "title", "type", "updatedAt") SELECT "companyId", "description", "expiresAt", "id", "modifier", "scope", "startsAt", "targetId", "title", "type", CURRENT_TIMESTAMP FROM "GameEvent";
DROP TABLE "GameEvent";
ALTER TABLE "new_GameEvent" RENAME TO "GameEvent";
CREATE TABLE "new_Loan" (
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
INSERT INTO "new_Loan" ("companyId", "createdAt", "id", "interestRate", "monthlyPayment", "paidMonths", "principal", "remainingAmount", "totalMonths", "updatedAt") SELECT "companyId", "createdAt", "id", "interestRate", "monthlyPayment", "paidMonths", "principal", "remainingAmount", "totalMonths", CURRENT_TIMESTAMP FROM "Loan";
DROP TABLE "Loan";
ALTER TABLE "new_Loan" RENAME TO "Loan";
CREATE TABLE "new_Reputation" (
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
INSERT INTO "new_Reputation" ("companyId", "destIcao", "flightCount", "id", "originIcao", "score", "updatedAt") SELECT "companyId", "destIcao", "flightCount", "id", "originIcao", "score", CURRENT_TIMESTAMP FROM "Reputation";
DROP TABLE "Reputation";
ALTER TABLE "new_Reputation" RENAME TO "Reputation";
CREATE UNIQUE INDEX "Reputation_originIcao_destIcao_companyId_key" ON "Reputation"("originIcao", "destIcao", "companyId");
CREATE TABLE "new_Route" (
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
INSERT INTO "new_Route" ("active", "basePrice", "companyId", "destIcao", "distanceNm", "id", "originIcao", "updatedAt") SELECT "active", "basePrice", "companyId", "destIcao", "distanceNm", "id", "originIcao", CURRENT_TIMESTAMP FROM "Route";
DROP TABLE "Route";
ALTER TABLE "new_Route" RENAME TO "Route";
CREATE TABLE "new_Transaction" (
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
INSERT INTO "new_Transaction" ("amount", "companyId", "createdAt", "description", "flightId", "id", "type", "updatedAt") SELECT "amount", "companyId", "createdAt", "description", "flightId", "id", "type", CURRENT_TIMESTAMP FROM "Transaction";
DROP TABLE "Transaction";
ALTER TABLE "new_Transaction" RENAME TO "Transaction";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "SyncLog_tableName_syncedAt_idx" ON "SyncLog"("tableName", "syncedAt");

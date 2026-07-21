-- CreateTable
CREATE TABLE "Dispatch" (
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Dispatch_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Company" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "capital" REAL NOT NULL DEFAULT 1000000,
    "hubIcao" TEXT,
    "activeAircraftId" TEXT,
    "airlineCode" TEXT NOT NULL DEFAULT 'THL',
    "simbriefUsername" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Company" ("activeAircraftId", "capital", "createdAt", "hubIcao", "id", "name") SELECT "activeAircraftId", "capital", "createdAt", "hubIcao", "id", "name" FROM "Company";
DROP TABLE "Company";
ALTER TABLE "new_Company" RENAME TO "Company";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

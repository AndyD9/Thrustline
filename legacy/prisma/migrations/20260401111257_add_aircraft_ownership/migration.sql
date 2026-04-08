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
    CONSTRAINT "Aircraft_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Aircraft" ("companyId", "cycles", "healthPct", "icaoType", "id", "leaseCostMo", "name", "totalHours") SELECT "companyId", "cycles", "healthPct", "icaoType", "id", "leaseCostMo", "name", "totalHours" FROM "Aircraft";
DROP TABLE "Aircraft";
ALTER TABLE "new_Aircraft" RENAME TO "Aircraft";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

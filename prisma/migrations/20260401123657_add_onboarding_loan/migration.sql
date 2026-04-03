-- CreateTable
CREATE TABLE "Loan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "principal" REAL NOT NULL,
    "monthlyPayment" REAL NOT NULL,
    "remainingAmount" REAL NOT NULL,
    "totalMonths" INTEGER NOT NULL,
    "paidMonths" INTEGER NOT NULL DEFAULT 0,
    "interestRate" REAL NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Loan_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
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
    "onboarded" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Company" ("activeAircraftId", "airlineCode", "capital", "createdAt", "hubIcao", "id", "name", "simbriefUsername") SELECT "activeAircraftId", "airlineCode", "capital", "createdAt", "hubIcao", "id", "name", "simbriefUsername" FROM "Company";
DROP TABLE "Company";
ALTER TABLE "new_Company" RENAME TO "Company";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

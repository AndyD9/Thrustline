-- CreateTable
CREATE TABLE "CrewMember" (
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
    CONSTRAINT "CrewMember_aircraftId_fkey" FOREIGN KEY ("aircraftId") REFERENCES "Aircraft" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CrewMember_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

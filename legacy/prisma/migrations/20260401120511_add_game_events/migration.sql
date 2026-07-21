-- CreateTable
CREATE TABLE "GameEvent" (
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
    CONSTRAINT "GameEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "capital" REAL NOT NULL DEFAULT 1000000,
    "hubIcao" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Aircraft" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "icaoType" TEXT NOT NULL,
    "healthPct" REAL NOT NULL DEFAULT 100,
    "leaseCostMo" REAL NOT NULL,
    "totalHours" REAL NOT NULL DEFAULT 0,
    "cycles" INTEGER NOT NULL DEFAULT 0,
    "companyId" TEXT NOT NULL,
    CONSTRAINT "Aircraft_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Flight" (
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Flight_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Flight_aircraftId_fkey" FOREIGN KEY ("aircraftId") REFERENCES "Aircraft" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Route" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "originIcao" TEXT NOT NULL,
    "destIcao" TEXT NOT NULL,
    "distanceNm" REAL NOT NULL,
    "basePrice" REAL NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "companyId" TEXT NOT NULL,
    CONSTRAINT "Route_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "description" TEXT NOT NULL,
    "flightId" TEXT,
    "companyId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

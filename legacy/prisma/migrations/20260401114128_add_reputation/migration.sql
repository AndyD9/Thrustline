-- CreateTable
CREATE TABLE "Reputation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "originIcao" TEXT NOT NULL,
    "destIcao" TEXT NOT NULL,
    "score" REAL NOT NULL DEFAULT 50,
    "flightCount" INTEGER NOT NULL DEFAULT 0,
    "companyId" TEXT NOT NULL,
    CONSTRAINT "Reputation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Reputation_originIcao_destIcao_companyId_key" ON "Reputation"("originIcao", "destIcao", "companyId");

import type { PrismaClient } from '../../generated/prisma/client'

export async function recordSync(
  prisma: PrismaClient,
  tableName: string,
  recordId: string,
  action: 'create' | 'update' | 'delete',
) {
  await prisma.syncLog.create({
    data: { tableName, recordId, action },
  })
}

import { PrismaClient } from '@prisma/client';

// Limit the connection pool tightly so we don't compete with VICIdial on the
// shared MySQL server. Auth no longer uses Prisma (see auth.service.ts).
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  datasources: {
    db: {
      url: (process.env.DATABASE_URL ?? '') + '?connection_limit=2&pool_timeout=10',
    },
  },
});

// Release connections cleanly on process exit so hot-reloads don't accumulate pools.
process.once('SIGTERM', () => prisma.$disconnect());
process.once('SIGINT',  () => prisma.$disconnect());

export default prisma;

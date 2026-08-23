import type { User as PrismaUser } from '@prisma/client';

declare global {
  namespace Express {
    // Merge our Prisma User into the Passport `Express.User` type so
    // `req.user` (which Passport types as `Express.User`) carries the
    // full Prisma fields (id, customerTier, isAdmin, …).
    interface User extends PrismaUser {}

    interface Request {
      aksSession?: string;
    }
  }
}

export {};

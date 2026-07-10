import { PrismaClient } from "@prisma/client";

declare global {
  var prismaBackend: PrismaClient | undefined;
}

export const prisma =
  global.prismaBackend ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.prismaBackend = prisma;
}


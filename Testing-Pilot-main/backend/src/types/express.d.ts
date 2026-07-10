import type { SessionUser } from "../lib/auth";

declare global {
  namespace Express {
    interface Request {
      auth?: SessionUser;
    }
  }
}

export {};


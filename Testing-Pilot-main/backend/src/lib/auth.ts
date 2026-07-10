import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import type { ApprovalStatus, Role } from "@prisma/client";
import { env } from "../config/env";

export type SessionUser = {
  userId: string;
  role: Role;
  approvalStatus: ApprovalStatus;
};

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export function signToken(payload: SessionUser) {
  return jwt.sign(payload, env.jwtSecret, {
    expiresIn: "7d",
  });
}

export function verifyToken(token: string) {
  return jwt.verify(token, env.jwtSecret) as SessionUser;
}


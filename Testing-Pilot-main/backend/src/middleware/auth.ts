import type { NextFunction, Request, Response } from "express";
import { ApprovalStatus, Role } from "@prisma/client";
import { verifyToken } from "../lib/auth";

function getToken(request: Request) {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.slice("Bearer ".length);
}

export function requireAuth(request: Request, response: Response, next: NextFunction) {
  const token = getToken(request);

  if (!token) {
    response.status(401).json({ error: "Missing authorization token." });
    return;
  }

  try {
    request.auth = verifyToken(token);
    next();
  } catch {
    response.status(401).json({ error: "Invalid authorization token." });
  }
}

export function requireApprovedUser(request: Request, response: Response, next: NextFunction) {
  if (!request.auth) {
    response.status(401).json({ error: "Unauthorized." });
    return;
  }

  if (request.auth.approvalStatus !== ApprovalStatus.APPROVED) {
    response.status(403).json({ error: "User is pending approval." });
    return;
  }

  next();
}

export function requireAdmin(request: Request, response: Response, next: NextFunction) {
  if (!request.auth || request.auth.role !== Role.ADMIN) {
    response.status(403).json({ error: "Admin access required." });
    return;
  }

  next();
}


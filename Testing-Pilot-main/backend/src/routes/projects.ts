import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireApprovedUser, requireAuth } from "../middleware/auth";

export const projectsRouter = Router();

projectsRouter.use(requireAuth, requireApprovedUser);

projectsRouter.get("/", async (request, response) => {
  const projects = await prisma.project.findMany({
    where: { ownerId: request.auth!.userId },
    include: {
      artifacts: {
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  response.json({ projects });
});

projectsRouter.post("/", async (request, response) => {
  const { name, description } = request.body;

  if (!name) {
    response.status(400).json({ error: "Project name is required." });
    return;
  }

  const project = await prisma.project.create({
    data: {
      name,
      description,
      ownerId: request.auth!.userId,
    },
  });

  response.json({ project });
});


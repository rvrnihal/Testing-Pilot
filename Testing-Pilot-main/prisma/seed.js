const { PrismaClient, Role, ApprovalStatus, ArtifactType } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const plans = [
    {
      name: "Starter",
      slug: "starter",
      priceMonthly: 29,
      creditsPerMonth: 250,
      description: "For solo QA engineers shipping documentation-based test coverage quickly.",
      features: [
        "Requirement to test case generation",
        "Bug analysis and test data generation",
        "250 AI credits every month",
      ],
      stripePriceId: process.env.STRIPE_PRICE_STARTER || null,
    },
    {
      name: "Growth",
      slug: "growth",
      priceMonthly: 79,
      creditsPerMonth: 1000,
      description: "For fast-moving QA teams automating more regression paths.",
      features: [
        "All Starter capabilities",
        "API test and release risk analysis",
        "1,000 AI credits every month",
      ],
      stripePriceId: process.env.STRIPE_PRICE_GROWTH || null,
    },
    {
      name: "Scale",
      slug: "scale",
      priceMonthly: 199,
      creditsPerMonth: 4000,
      description: "For organizations running multi-project QA programs with governance.",
      features: [
        "All Growth capabilities",
        "Project workspace and platform analytics",
        "4,000 AI credits every month",
      ],
      stripePriceId: process.env.STRIPE_PRICE_SCALE || null,
    },
  ];

  for (const plan of plans) {
    await prisma.subscriptionPlan.upsert({
      where: { slug: plan.slug },
      update: plan,
      create: plan,
    });
  }

  const starterPlan = await prisma.subscriptionPlan.findUniqueOrThrow({
    where: { slug: "starter" },
  });

  const adminPasswordHash = await bcrypt.hash("Admin@123", 10);
  const runnerPasswordHash = await bcrypt.hash("Runner@123", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@qacopilot.ai" },
    update: {
      name: "QA Copilot Admin",
      passwordHash: adminPasswordHash,
      role: Role.ADMIN,
      approvalStatus: ApprovalStatus.APPROVED,
      creditsBalance: 4000,
    },
    create: {
      name: "QA Copilot Admin",
      email: "admin@qacopilot.ai",
      passwordHash: adminPasswordHash,
      role: Role.ADMIN,
      approvalStatus: ApprovalStatus.APPROVED,
      creditsBalance: 4000,
    },
  });

  await prisma.subscription.upsert({
    where: { userId: admin.id },
    update: {
      planId: starterPlan.id,
      status: "active",
    },
    create: {
      userId: admin.id,
      planId: starterPlan.id,
      status: "active",
    },
  });

  const runner = await prisma.user.upsert({
    where: { email: "runner@qacopilot.ai" },
    update: {
      name: "QA Copilot Runner",
      passwordHash: runnerPasswordHash,
      role: Role.USER,
      approvalStatus: ApprovalStatus.APPROVED,
      creditsBalance: starterPlan.creditsPerMonth,
      company: "QA Copilot",
    },
    create: {
      name: "QA Copilot Runner",
      email: "runner@qacopilot.ai",
      passwordHash: runnerPasswordHash,
      role: Role.USER,
      approvalStatus: ApprovalStatus.APPROVED,
      creditsBalance: starterPlan.creditsPerMonth,
      company: "QA Copilot",
    },
  });

  await prisma.subscription.upsert({
    where: { userId: runner.id },
    update: {
      planId: starterPlan.id,
      status: "active",
    },
    create: {
      userId: runner.id,
      planId: starterPlan.id,
      status: "active",
    },
  });

  await prisma.project.upsert({
    where: { id: "runner-demo-project" },
    update: {
      ownerId: runner.id,
      name: "Runner Workspace",
      description: "Seeded user workspace for automated execution flows.",
    },
    create: {
      id: "runner-demo-project",
      ownerId: runner.id,
      name: "Runner Workspace",
      description: "Seeded user workspace for automated execution flows.",
    },
  });

  const project = await prisma.project.upsert({
    where: { id: "admin-demo-project" },
    update: {
      ownerId: admin.id,
      name: "Demo Banking App",
      description: "Seeded project workspace for QA Copilot walkthroughs.",
    },
    create: {
      id: "admin-demo-project",
      ownerId: admin.id,
      name: "Demo Banking App",
      description: "Seeded project workspace for QA Copilot walkthroughs.",
    },
  });

  await prisma.projectArtifact.create({
    data: {
      projectId: project.id,
      type: ArtifactType.TEST_CASES,
      title: "Seeded checkout validation suite",
      inputText: "Users should be blocked from checkout if card CVV is invalid.",
      outputText: "Functional, edge, negative, and security test cases were generated for checkout validation.",
      outputJson: [
        {
          id: "TC-1001",
          scenario: "Reject invalid CVV during checkout",
          steps: ["Open checkout", "Enter invalid CVV", "Submit payment"],
          expectedResult: "Payment is rejected with inline validation.",
        },
      ],
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });

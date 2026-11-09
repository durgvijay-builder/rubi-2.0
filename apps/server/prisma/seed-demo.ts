import { PrismaClient, Role, TaskStatus, TaskPriority, ActivityEventType } from '@prisma/client';

const prisma = new PrismaClient();

export const DEMO_WORKSPACE_ID = 'workspace-rubi-demo-001';
export const DEMO_WORKSPACE_NAME = 'Gnani Demo — Product Launch';

async function main() {
  console.log(`Seeding clean demo workspace: "${DEMO_WORKSPACE_NAME}" (${DEMO_WORKSPACE_ID})...`);

  // 1. Create or update Demo Workspace
  const workspace = await prisma.workspace.upsert({
    where: { id: DEMO_WORKSPACE_ID },
    update: {
      name: DEMO_WORKSPACE_NAME,
      slug: 'gnani-demo-launch',
    },
    create: {
      id: DEMO_WORKSPACE_ID,
      name: DEMO_WORKSPACE_NAME,
      slug: 'gnani-demo-launch',
    },
  });

  // 2. Realistic Indian Team Members
  const userRahul = await prisma.user.upsert({
    where: { email: 'rahul.sharma@demo.rubi.ai' },
    update: { name: 'Rahul Sharma', role: Role.ADMIN, workspaceId: workspace.id },
    create: {
      id: 'demo-user-rahul',
      email: 'rahul.sharma@demo.rubi.ai',
      name: 'Rahul Sharma',
      role: Role.ADMIN,
      workspaceId: workspace.id,
    },
  });

  const userPriya = await prisma.user.upsert({
    where: { email: 'priya.patel@demo.rubi.ai' },
    update: { name: 'Priya Patel', role: Role.MEMBER, workspaceId: workspace.id },
    create: {
      id: 'demo-user-priya',
      email: 'priya.patel@demo.rubi.ai',
      name: 'Priya Patel',
      role: Role.MEMBER,
      workspaceId: workspace.id,
    },
  });

  const userAlex = await prisma.user.upsert({
    where: { email: 'alex.morgan@demo.rubi.ai' },
    update: { name: 'Alex Morgan', role: Role.OWNER, workspaceId: workspace.id },
    create: {
      id: 'demo-user-alex',
      email: 'alex.morgan@demo.rubi.ai',
      name: 'Alex Morgan',
      role: Role.OWNER,
      workspaceId: workspace.id,
    },
  });

  // 3. Clear existing demo workspace tasks to make seed completely idempotent and crisp
  await prisma.activityEvent.deleteMany({ where: { workspaceId: workspace.id } });
  await prisma.taskDependency.deleteMany({
    where: {
      OR: [
        { task: { workspaceId: workspace.id } },
        { dependsOn: { workspaceId: workspace.id } },
      ],
    },
  });
  await prisma.task.deleteMany({ where: { workspaceId: workspace.id } });

  // 4. Create 6 High-Quality Realistic Product Tasks
  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;

  // Task 1: Complete authentication & session verification API
  const task1 = await prisma.task.create({
    data: {
      id: 'demo-task-01-auth-api',
      workspaceId: workspace.id,
      title: 'Complete Authentication & Session Verification API',
      description: 'Implement JWT refresh rotation and workspace tenant authorization endpoints for mobile and web clients.',
      status: TaskStatus.COMPLETED,
      priority: TaskPriority.CRITICAL,
      assigneeId: userRahul.id,
      creatorId: userRahul.id,
      deadline: new Date(now.getTime() - 1 * dayMs),
    },
  });

  // Task 2: Integrate Gnani Prisma STT Multilingual Pipeline
  const task2 = await prisma.task.create({
    data: {
      id: 'demo-task-02-stt-pipeline',
      workspaceId: workspace.id,
      title: 'Integrate Gnani Prisma STT Multilingual Pipeline',
      description: 'Configure real-time audio stream upload with Hindi, English, and Hinglish auto-detection heuristics.',
      status: TaskStatus.COMPLETED,
      priority: TaskPriority.HIGH,
      assigneeId: userAlex.id,
      creatorId: userAlex.id,
      deadline: new Date(now.getTime() - 0.5 * dayMs),
    },
  });

  // Task 3: Build Human-in-the-Loop Voice Approval Interface
  const task3 = await prisma.task.create({
    data: {
      id: 'demo-task-03-hitl-ui',
      workspaceId: workspace.id,
      title: 'Build Human-in-the-Loop Voice Approval Interface',
      description: 'Implement staging review drawer with inline task edits and zero auto-commit enforcement.',
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.HIGH,
      assigneeId: userPriya.id,
      creatorId: userPriya.id,
      deadline: new Date(now.getTime() + 1 * dayMs),
    },
  });

  // Task 4: Connect Gnani Timbre TTS Spoken Confirmation Player
  const task4 = await prisma.task.create({
    data: {
      id: 'demo-task-04-tts-player',
      workspaceId: workspace.id,
      title: 'Connect Gnani Timbre TTS Spoken Confirmation Player',
      description: 'Synthesize immediate voice confirmation in Shivani timbre voice upon task batch approvals.',
      status: TaskStatus.TODO,
      priority: TaskPriority.MEDIUM,
      assigneeId: userRahul.id,
      creatorId: userRahul.id,
      deadline: new Date(now.getTime() + 2 * dayMs),
    },
  });

  // Task 5: Mobile Responsive Layout & Touch Target Auditing
  const task5 = await prisma.task.create({
    data: {
      id: 'demo-task-05-mobile-audit',
      workspaceId: workspace.id,
      title: 'Mobile Responsive Layout & Touch Target Auditing',
      description: 'Verify 320px, 375px, and 430px viewports with zero horizontal overflow and 44px touch targets.',
      status: TaskStatus.BLOCKED,
      priority: TaskPriority.HIGH,
      assigneeId: userPriya.id,
      creatorId: userPriya.id,
      deadline: new Date(now.getTime() + 3 * dayMs),
    },
  });

  // Task 6: Final Gnani AI Internship Submission Showcase
  const task6 = await prisma.task.create({
    data: {
      id: 'demo-task-06-final-showcase',
      workspaceId: workspace.id,
      title: 'Final Gnani AI Internship Submission Showcase',
      description: 'Record end-to-end video demonstration showcasing voice-to-action workflow and technical defensibility.',
      status: TaskStatus.TODO,
      priority: TaskPriority.CRITICAL,
      assigneeId: userAlex.id,
      creatorId: userAlex.id,
      deadline: new Date(now.getTime() + 5 * dayMs),
    },
  });

  // 5. Explicit Relational Dependencies
  // Task 3 (HITL UI) depends on Task 1 (Auth API)
  await prisma.taskDependency.create({
    data: { taskId: task3.id, dependsOnId: task1.id },
  });

  // Task 5 (Mobile audit) is blocked by Task 3 (HITL UI)
  await prisma.taskDependency.create({
    data: { taskId: task5.id, dependsOnId: task3.id },
  });

  // Task 6 (Final showcase) depends on Task 4 (TTS player) and Task 5 (Mobile audit)
  await prisma.taskDependency.create({
    data: { taskId: task6.id, dependsOnId: task4.id },
  });
  await prisma.taskDependency.create({
    data: { taskId: task6.id, dependsOnId: task5.id },
  });

  // 6. Realistic Activity History Audit Log
  await prisma.activityEvent.createMany({
    data: [
      {
        workspaceId: workspace.id,
        taskId: task1.id,
        actorId: userRahul.id,
        eventType: ActivityEventType.TASK_STATUS_CHANGED,
        description: 'Completed authentication & session verification API endpoints with full test coverage.',
        metadata: { previousStatus: 'IN_PROGRESS', newStatus: 'COMPLETED', actorType: 'USER' },
        createdAt: new Date(now.getTime() - 20 * 60 * 1000),
      },
      {
        workspaceId: workspace.id,
        taskId: task2.id,
        actorId: userAlex.id,
        eventType: ActivityEventType.TASK_STATUS_CHANGED,
        description: 'Completed Gnani Prisma STT adapter integration for Hindi and English voice streams.',
        metadata: { previousStatus: 'IN_PROGRESS', newStatus: 'COMPLETED', actorType: 'USER' },
        createdAt: new Date(now.getTime() - 15 * 60 * 1000),
      },
      {
        workspaceId: workspace.id,
        taskId: task3.id,
        actorId: userPriya.id,
        eventType: ActivityEventType.TASK_CREATED,
        description: 'Extracted task "Build Human-in-the-Loop Voice Approval Interface" from voice meeting transcript.',
        metadata: { bypassLLM: false, source: 'voice', actorType: 'AI' },
        createdAt: new Date(now.getTime() - 10 * 60 * 1000),
      },
      {
        workspaceId: workspace.id,
        taskId: task5.id,
        actorId: userPriya.id,
        eventType: ActivityEventType.TASK_STATUS_CHANGED,
        description: 'Marked "Mobile Responsive Layout & Touch Target Auditing" as BLOCKED pending HITL interface completion.',
        metadata: { previousStatus: 'TODO', newStatus: 'BLOCKED', actorType: 'SYSTEM' },
        createdAt: new Date(now.getTime() - 5 * 60 * 1000),
      },
    ],
  });

  console.log('Clean demo workspace seeded successfully!');
  console.log(`- Workspace ID: ${workspace.id}`);
  console.log(`- Tasks created: 6`);
  console.log(`- Dependency edges: 4`);
  console.log(`- Activity events: 4`);
}

main()
  .catch((e) => {
    console.error('Seed demo error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

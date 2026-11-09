import { PrismaClient, Role, TaskStatus, TaskPriority, ActivityEventType } from '@prisma/client';

const prisma = new PrismaClient();

export const DEFAULT_WORKSPACE_ID = '11111111-1111-1111-1111-111111111111';
export const PRIMARY_WORKSPACE_ID = 'workspace-rubi-primary-001';
export const DEMO_OWNER_ID = '22222222-2222-2222-2222-222222222222';
export const DEMO_ADMIN_ID = '33333333-3333-3333-3333-333333333333';
export const PRIMARY_USER_ID = 'user-durgvijay-001';

export const DEFAULT_PERSONAL_CATEGORIES = [
  { name: 'College', color: '#3b82f6' },
  { name: 'Self learning', color: '#8b5cf6' },
  { name: 'Side hustle', color: '#10b981' },
  { name: 'Channel', color: '#f59e0b' },
  { name: 'Ghar ka!', color: '#ec4899' },
];

export async function seedDefaultCategories(workspaceId: string) {
  const ws = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  if (!ws) return;

  for (const cat of DEFAULT_PERSONAL_CATEGORIES) {
    await prisma.category.upsert({
      where: {
        workspaceId_name: {
          workspaceId,
          name: cat.name,
        },
      },
      update: {
        color: cat.color,
        isDefault: true,
      },
      create: {
        workspaceId,
        name: cat.name,
        color: cat.color,
        isDefault: true,
      },
    });
  }
  await prisma.userSettings.upsert({
    where: { workspaceId },
    update: {},
    create: {
      workspaceId,
      timezone: 'Asia/Kolkata',
    },
  });
}

async function main() {
  console.log('Seeding R.U.B.I. 2.0 development database...');

  // Upsert Default Showcase Workspace
  const workspace = await prisma.workspace.upsert({
    where: { id: DEFAULT_WORKSPACE_ID },
    update: {
      name: 'R.U.B.I. Showcase',
      slug: 'rubi-showcase',
    },
    create: {
      id: DEFAULT_WORKSPACE_ID,
      name: 'R.U.B.I. Showcase',
      slug: 'rubi-showcase',
    },
  });
  console.log(`Workspace upserted: ${workspace.name} (${workspace.id})`);

  // Upsert Demo Owner User
  const owner = await prisma.user.upsert({
    where: { email: 'alex@example.com' },
    update: {
      name: 'Alex Morgan',
      role: Role.OWNER,
      workspaceId: workspace.id,
    },
    create: {
      id: DEMO_OWNER_ID,
      workspaceId: workspace.id,
      email: 'alex@example.com',
      name: 'Alex Morgan',
      role: Role.OWNER,
    },
  });

  // Upsert Demo Admin/Reviewer User
  const admin = await prisma.user.upsert({
    where: { email: 'reviewer@example.com' },
    update: {
      name: 'Sam Wilson',
      role: Role.ADMIN,
      workspaceId: workspace.id,
    },
    create: {
      id: DEMO_ADMIN_ID,
      workspaceId: workspace.id,
      email: 'reviewer@example.com',
      name: 'Sam Wilson',
      role: Role.ADMIN,
    },
  });
  console.log(`Users upserted: ${owner.name}, ${admin.name}`);

  // Seed Initial Tasks
  const task1Id = 'aaaa1111-1111-1111-1111-111111111111';
  const task2Id = 'bbbb2222-2222-2222-2222-222222222222';
  const task3Id = 'cccc3333-3333-3333-3333-333333333333';
  const task4Id = 'dddd4444-4444-4444-4444-444444444444';
  const task5Id = 'eeee5555-5555-5555-5555-555555555555';

  const task1 = await prisma.task.upsert({
    where: { id: task1Id },
    update: {},
    create: {
      id: task1Id,
      workspaceId: workspace.id,
      creatorId: owner.id,
      assigneeId: owner.id,
      title: 'Prisma STT Model Audio Evaluation',
      description: 'Run STT transcription benchmarks across English, Hindi, and Hinglish speech samples.',
      status: TaskStatus.COMPLETED,
      priority: TaskPriority.HIGH,
      durationMins: 45,
      rawTranscript: 'kal dopahar ko gnani stt audio testing complete karni hai',
    },
  });

  const task2 = await prisma.task.upsert({
    where: { id: task2Id },
    update: {},
    create: {
      id: task2Id,
      workspaceId: workspace.id,
      creatorId: owner.id,
      assigneeId: admin.id,
      title: 'Timbre TTS Speech Synthesis Pipeline Integration',
      description: 'Integrate spoken voice playback confirmation for approved task actions.',
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.HIGH,
      durationMins: 60,
      rawTranscript: 'TTS synthesis playback wireup karna hai approval ke baad bolne ke liye',
    },
  });

  const task3 = await prisma.task.upsert({
    where: { id: task3Id },
    update: {},
    create: {
      id: task3Id,
      workspaceId: workspace.id,
      creatorId: admin.id,
      assigneeId: owner.id,
      title: 'Human-in-the-Loop Approval Queue Verification',
      description: 'Verify that silence never implies consent and all extracted tasks require explicit approval.',
      status: TaskStatus.BLOCKED,
      priority: TaskPriority.CRITICAL,
      durationMins: 90,
      rawTranscript: 'approval queue verify karo check karo koi task bina permission save na ho',
    },
  });

  const task4 = await prisma.task.upsert({
    where: { id: task4Id },
    update: {},
    create: {
      id: task4Id,
      workspaceId: workspace.id,
      creatorId: owner.id,
      assigneeId: owner.id,
      title: 'Multi-device Viewport Responsiveness Polish',
      description: 'Verify 320px, 375px, 430px mobile viewports render cleanly without horizontal overflow.',
      status: TaskStatus.TODO,
      priority: TaskPriority.MEDIUM,
      durationMins: 60,
    },
  });

  const task5 = await prisma.task.upsert({
    where: { id: task5Id },
    update: {},
    create: {
      id: task5Id,
      workspaceId: workspace.id,
      creatorId: owner.id,
      assigneeId: null,
      title: 'Draft Agriculture Website Landing Page',
      description: 'Create basic landing page for agriculture project (estimated 2 hours).',
      status: TaskStatus.PENDING_APPROVAL,
      priority: TaskPriority.MEDIUM,
      durationMins: 120,
      rawTranscript:
        'mera ek aur task add kar do mujhe ek website banani hai agriculture ke upar to uske liye mujhe thoda time lagega basic landing page hi banana hai to mujhe aaram se do ghante lag jayenge to main chahta hu tum use kal ke liye schedule kar do dopahar me rakhna usko',
    },
  });

  // Upsert Task Dependency: Task 3 depends on Task 2 (prerequisite)
  await prisma.taskDependency.upsert({
    where: {
      taskId_dependsOnId: {
        taskId: task3.id,
        dependsOnId: task2.id,
      },
    },
    update: {},
    create: {
      taskId: task3.id,
      dependsOnId: task2.id,
    },
  });
  console.log(`Dependency established: "${task3.title}" blocked by "${task2.title}"`);

  // Seed Activity Events
  await prisma.activityEvent.create({
    data: {
      workspaceId: workspace.id,
      actorId: owner.id,
      taskId: task5.id,
      eventType: ActivityEventType.EXTRACTION_STAGED,
      description: 'Voice transcript extracted 1 task awaiting human approval',
      metadata: {
        promptTokens: 145,
        completionTokens: 82,
        estimatedCostUsd: 0.00018,
      },
    },
  });

  await prisma.activityEvent.create({
    data: {
      workspaceId: workspace.id,
      actorId: admin.id,
      taskId: task3.id,
      eventType: ActivityEventType.TASK_BLOCKED,
      description: 'Task marked BLOCKED pending completion of TTS Speech Synthesis Pipeline Integration',
    },
  });

  // Seed Primary E2E Workspace (workspace-rubi-primary-001)
  const primaryWorkspace = await prisma.workspace.upsert({
    where: { id: PRIMARY_WORKSPACE_ID },
    update: {
      name: 'Engineering Core',
      slug: 'engineering-core',
    },
    create: {
      id: PRIMARY_WORKSPACE_ID,
      name: 'Engineering Core',
      slug: 'engineering-core',
    },
  });

  const primaryUser = await prisma.user.upsert({
    where: { id: PRIMARY_USER_ID },
    update: {
      name: 'Alex Morgan',
      role: Role.ADMIN,
      workspaceId: primaryWorkspace.id,
    },
    create: {
      id: PRIMARY_USER_ID,
      workspaceId: primaryWorkspace.id,
      email: 'alex.core@rubi.ai',
      name: 'Alex Morgan',
      role: Role.ADMIN,
    },
  });

  const sarahUser = await prisma.user.upsert({
    where: { email: 'sarah.core@rubi.ai' },
    update: {
      name: 'Sarah',
      role: Role.MEMBER,
      workspaceId: primaryWorkspace.id,
    },
    create: {
      workspaceId: primaryWorkspace.id,
      email: 'sarah.core@rubi.ai',
      name: 'Sarah',
      role: Role.MEMBER,
    },
  });

  const alexUser = await prisma.user.upsert({
    where: { email: 'alex.core@rubi.ai' },
    update: {
      name: 'Alex',
      role: Role.MEMBER,
      workspaceId: primaryWorkspace.id,
    },
    create: {
      workspaceId: primaryWorkspace.id,
      email: 'alex.core@rubi.ai',
      name: 'Alex',
      role: Role.MEMBER,
    },
  });

  await prisma.task.upsert({
    where: { id: 'task-seed-1' },
    update: {},
    create: {
      id: 'task-seed-1',
      workspaceId: primaryWorkspace.id,
      creatorId: primaryUser.id,
      assigneeId: primaryUser.id,
      title: 'Initialize repository structure',
      description: 'Setup monorepo and packages',
      status: TaskStatus.COMPLETED,
      priority: TaskPriority.HIGH,
      deadline: new Date('2026-11-06T18:00:00.000Z'),
      isArchived: false,
    },
  });

  await prisma.task.upsert({
    where: { id: 'task-seed-2' },
    update: {},
    create: {
      id: 'task-seed-2',
      workspaceId: primaryWorkspace.id,
      creatorId: primaryUser.id,
      assigneeId: sarahUser.id,
      title: 'Review legacy database models',
      description: 'Audit SQLite and Supabase schema',
      status: TaskStatus.TODO,
      priority: TaskPriority.MEDIUM,
      deadline: new Date('2026-11-09T17:00:00.000Z'),
      isArchived: false,
    },
  });

  await prisma.task.upsert({
    where: { id: 'task-seed-3' },
    update: {},
    create: {
      id: 'task-seed-3',
      workspaceId: primaryWorkspace.id,
      creatorId: primaryUser.id,
      assigneeId: alexUser.id,
      title: 'Deploy native PostgreSQL 18.6 container',
      description: 'Run native postgres on port 5432',
      status: TaskStatus.TODO,
      priority: TaskPriority.HIGH,
      deadline: new Date('2026-11-10T12:00:00.000Z'),
      isArchived: false,
    },
  });

  // Seed default personal categories and user settings
  await seedDefaultCategories(workspace.id);
  await seedDefaultCategories(primaryWorkspace.id);
  await seedDefaultCategories('workspace-rubi-demo-001');

  console.log('Seeding completed successfully!');
}

const isDirectRun =
  Boolean(process.argv[1]) &&
  (process.argv[1].endsWith('seed.ts') || process.argv[1].endsWith('seed.js'));

if (isDirectRun) {
  main()
    .catch((e) => {
      console.error('Seed error:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

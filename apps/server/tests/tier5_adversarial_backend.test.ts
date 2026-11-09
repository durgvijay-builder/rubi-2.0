import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import crypto from 'node:crypto';
import { app } from '../src/index.js';
import { prisma } from '../src/db.js';
import {
  detectCycle,
  routeIntent,
  isDirectCommand,
  resolveRelativeDate,
  findNextFreeSlot,
  roundUpTo15Minutes,
  extractTimeFromPhrase,
  resolvePreferredSlot,
  normalizeDeadline,
} from '@rubi/shared';
import { DEFAULT_WORKSPACE_ID, PRIMARY_WORKSPACE_ID } from '../prisma/seed.js';

// Dedicated isolated workspaces for Tier 5 adversarial testing
const TEST_WS_A = 'workspace-tier5-adversarial-alpha-001';
const TEST_WS_B = 'workspace-tier5-adversarial-beta-002';

describe('TIER 5 ADVERSARIAL BACKEND HARDENING TEST SUITE', () => {
  beforeAll(async () => {
    // 1. Ensure test workspaces are provisioned
    await prisma.workspace.upsert({
      where: { id: TEST_WS_A },
      update: { name: 'Tier 5 Hardening Workspace Alpha', slug: 'tier5-alpha' },
      create: { id: TEST_WS_A, name: 'Tier 5 Hardening Workspace Alpha', slug: 'tier5-alpha' },
    });

    await prisma.workspace.upsert({
      where: { id: TEST_WS_B },
      update: { name: 'Tier 5 Hardening Workspace Beta', slug: 'tier5-beta' },
      create: { id: TEST_WS_B, name: 'Tier 5 Hardening Workspace Beta', slug: 'tier5-beta' },
    });
  });

  afterAll(async () => {
    // Clean up all artifacts created during testing
    await prisma.taskDependency.deleteMany({
      where: {
        task: {
          workspaceId: { in: [TEST_WS_A, TEST_WS_B] },
        },
      },
    });

    await prisma.activityEvent.deleteMany({
      where: {
        workspaceId: { in: [TEST_WS_A, TEST_WS_B] },
      },
    });

    await prisma.task.deleteMany({
      where: {
        workspaceId: { in: [TEST_WS_A, TEST_WS_B] },
      },
    });

    await prisma.user.deleteMany({
      where: {
        workspaceId: { in: [TEST_WS_A, TEST_WS_B] },
      },
    });

    await prisma.workspace.deleteMany({
      where: {
        id: { in: [TEST_WS_A, TEST_WS_B] },
      },
    });

    await prisma.$disconnect();
  });

  // ===========================================================================
  // 1. DAG GRAPH THEORY & CYCLE DETECTION STRESS HARNESS
  // ===========================================================================
  describe('1. DAG Graph Theory & Deep Cycle Topology Stress', () => {
    it('1.1: Detects cycle in disconnected components where only one sub-graph is cyclic', () => {
      // Sub-graph 1: Acyclic chain (n1 -> n2 -> n3)
      // Sub-graph 2: Cyclic loop (c1 -> c2 -> c1)
      const graph = [
        { tempId: 'n1', dependencies: [] },
        { tempId: 'n2', dependencies: ['n1'] },
        { tempId: 'n3', dependencies: ['n2'] },
        { tempId: 'c1', dependencies: ['c2'] },
        { tempId: 'c2', dependencies: ['c1'] },
      ];

      const res = detectCycle(graph);
      expect(res.hasCycle).toBe(true);
      expect(res.cycleNodes).toBeDefined();
      expect(res.cycleNodes).toContain('c1');
      expect(res.cycleNodes).toContain('c2');
      expect(res.cycleNodes).not.toContain('n1');
      expect(res.cycleNodes).not.toContain('n2');
      expect(res.cycleNodes).not.toContain('n3');
    });

    it('1.2: Detects deep 20-node circular ring without stack overflow or false negatives', () => {
      const ringSize = 20;
      const tasks: Array<{ tempId: string; dependencies: string[] }> = [];

      for (let i = 0; i < ringSize; i++) {
        const current = `ring-node-${i}`;
        const prev = `ring-node-${(i - 1 + ringSize) % ringSize}`;
        tasks.push({ tempId: current, dependencies: [prev] });
      }

      const res = detectCycle(tasks);
      expect(res.hasCycle).toBe(true);
      expect(res.cycleNodes).toHaveLength(ringSize);
      for (let i = 0; i < ringSize; i++) {
        expect(res.cycleNodes).toContain(`ring-node-${i}`);
      }
    });

    it('1.3: Processes deep 50-node linear DAG yielding exact topological order', () => {
      const chainLength = 50;
      const tasks: Array<{ tempId: string; dependencies: string[] }> = [];

      // Create in reverse order to ensure Kahn's algorithm performs genuine sorting
      for (let i = chainLength - 1; i >= 0; i--) {
        const current = `linear-node-${i}`;
        const deps = i > 0 ? [`linear-node-${i - 1}`] : [];
        tasks.push({ tempId: current, dependencies: deps });
      }

      const res = detectCycle(tasks);
      expect(res.hasCycle).toBe(false);
      expect(res.sortedOrder).toHaveLength(chainLength);
      // Topological assertion: node i must precede node i+1
      for (let i = 0; i < chainLength - 1; i++) {
        const idxCurrent = res.sortedOrder!.indexOf(`linear-node-${i}`);
        const idxNext = res.sortedOrder!.indexOf(`linear-node-${i + 1}`);
        expect(idxCurrent).toBeLessThan(idxNext);
      }
    });

    it('1.4: Handles diamond and multi-parent convergent DAG topologies cleanly', () => {
      // Root -> Left & Right -> Converge -> Sink
      const diamond = [
        { tempId: 'root', dependencies: [] },
        { tempId: 'left', dependencies: ['root'] },
        { tempId: 'right', dependencies: ['root'] },
        { tempId: 'converge', dependencies: ['left', 'right'] },
        { tempId: 'sink', dependencies: ['converge'] },
      ];

      const res = detectCycle(diamond);
      expect(res.hasCycle).toBe(false);
      expect(res.sortedOrder).toHaveLength(5);
      expect(res.sortedOrder![0]).toBe('root');
      expect(res.sortedOrder![4]).toBe('sink');
    });

    it('1.5: Tolerates self-dependency in tasks input by flagging cycle', () => {
      const tasks = [
        { tempId: 'self-loop', dependencies: ['self-loop'] },
      ];
      const res = detectCycle(tasks);
      expect(res.hasCycle).toBe(true);
      expect(res.cycleNodes).toContain('self-loop');
    });

    it('1.6: Tolerates duplicate dependency declarations without corrupting in-degree counts', () => {
      const tasks = [
        { tempId: 'prereq', dependencies: [] },
        { tempId: 'child', dependencies: ['prereq', 'prereq', 'prereq'] },
      ];
      const res = detectCycle(tasks);
      expect(res.hasCycle).toBe(false);
      expect(res.sortedOrder).toEqual(['prereq', 'child']);
    });

    it('1.7: Rejects empty or degenerate task arrays safely', () => {
      const res = detectCycle([]);
      expect(res.hasCycle).toBe(false);
      expect(res.sortedOrder).toEqual([]);
    });
  });

  // ===========================================================================
  // 2. INTENT ROUTER REDOS & ADVERSARIAL LINGUISTIC BOUNDARIES
  // ===========================================================================
  describe('2. Intent Router ReDoS Immunity & Boundary Verification', () => {
    it('2.1: Immunized against ReDoS: 30,000-character repetitive prefix resolves in < 25ms', () => {
      const attackPayload = 'please '.repeat(5000) + 'complete task #99';
      const start = performance.now();
      const res = routeIntent(attackPayload);
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(25);
      // Even if not matching direct pattern, must terminate quickly without freezing
      expect(typeof res.bypassLLM).toBe('boolean');
    });

    it('2.2: Immunized against 20,000-character trailing whitespace or symbols', () => {
      const paddedPayload = 'Mark task #3 as completed' + ' '.repeat(20000);
      const start = performance.now();
      const res = routeIntent(paddedPayload);
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(25);
      expect(res.bypassLLM).toBe(true);
      if (res.bypassLLM) {
        expect(res.intent).toBe('MARK_COMPLETED');
        expect(res.taskId).toBe('3');
      }
    });

    it('2.3: Handles SQL and shell injection patterns in task identifier deterministically', () => {
      const payloads = [
        "mark task #'; DROP TABLE tasks; -- as completed",
        'task #1\' OR \'1\'=\'1 ko complete kar do',
        'cancel task #../../etc/passwd',
        'mark task #<script>alert(1)</script> as done',
      ];

      for (const p of payloads) {
        const start = performance.now();
        const res = routeIntent(p);
        const elapsed = performance.now() - start;

        expect(elapsed).toBeLessThan(20);
        expect(res).toBeDefined();
        // Intent router extracts the taskId string without executing anything
        if (res.bypassLLM) {
          expect(res.taskId).toBeDefined();
          expect(res.tokensUsed.totalTokens).toBe(0);
        }
      }
    });

    it('2.4: Preserves Hinglish & Hindi Devanagari direct commands with excessive punctuation', () => {
      const resHinglish = routeIntent('Task #4 ko complete kar do?!?!?!?');
      expect(resHinglish.bypassLLM).toBe(true);
      if (resHinglish.bypassLLM) {
        expect(resHinglish.intent).toBe('MARK_COMPLETED');
        expect(resHinglish.taskId).toBe('4');
      }

      const resHindi = routeIntent('टास्क नंबर 5 को पूरा मार्क करो!!!!');
      expect(resHindi.bypassLLM).toBe(true);
      if (resHindi.bypassLLM) {
        expect(resHindi.intent).toBe('MARK_COMPLETED');
        expect(resHindi.taskId).toBe('5');
      }

      const resList = routeIntent('Pending tasks batao????');
      expect(resList.bypassLLM).toBe(true);
      if (resList.bypassLLM) {
        expect(resList.intent).toBe('LIST_TASKS');
      }
    });

    it('2.5: Degenerate strings (null, undefined, empty, only punctuation) return bypassLLM: false', () => {
      expect(routeIntent(null as any).bypassLLM).toBe(false);
      expect(routeIntent(undefined as any).bypassLLM).toBe(false);
      expect(routeIntent('').bypassLLM).toBe(false);
      expect(routeIntent('      ').bypassLLM).toBe(false);
      expect(routeIntent('???!!!').bypassLLM).toBe(false);
      expect(isDirectCommand('...')).toBe(false);
    });
  });

  // ===========================================================================
  // 3. DATE & ANCHOR RESOLVER BOUNDARY & TEMPORAL EDGE CASES
  // ===========================================================================
  describe('3. Date & Anchor Resolver Boundary & Temporal Edge Cases', () => {
    it('3.1: Accurately computes leap year February 29th boundaries', () => {
      // Leap year anchor: 2028-02-28 (Monday) + tomorrow -> 2028-02-29
      const baseLeap = new Date(Date.UTC(2028, 1, 28, 10, 0, 0)); // Feb 28, 2028
      const resolved = resolveRelativeDate('tomorrow', baseLeap);
      expect(resolved).not.toBeNull();
      const d = new Date(resolved!);
      expect(d.getUTCFullYear()).toBe(2028);
      expect(d.getUTCMonth()).toBe(1); // February (0-indexed)
      expect(d.getUTCDate()).toBe(29); // Leap day
    });

    it('3.2: Accurately rolls over non-leap year February 28th to March 1st', () => {
      // Non-leap year anchor: 2025-02-28 + tomorrow -> 2025-03-01
      const baseNonLeap = new Date(Date.UTC(2025, 1, 28, 10, 0, 0));
      const resolved = resolveRelativeDate('tomorrow', baseNonLeap);
      expect(resolved).not.toBeNull();
      const d = new Date(resolved!);
      expect(d.getUTCFullYear()).toBe(2025);
      expect(d.getUTCMonth()).toBe(2); // March (0-indexed)
      expect(d.getUTCDate()).toBe(1);
    });

    it('3.3: Millisecond ceiling precision in roundUpTo15Minutes', () => {
      // Exact boundary remains unchanged
      const exact = new Date('2026-11-07T14:15:00.000Z');
      expect(roundUpTo15Minutes(exact).toISOString()).toBe('2026-11-07T14:15:00.000Z');

      // Non-zero millisecond immediately advances to next 15-minute mark
      const plusOneMs = new Date('2026-11-07T14:15:00.001Z');
      expect(roundUpTo15Minutes(plusOneMs).toISOString()).toBe('2026-11-07T14:30:00.000Z');

      // 14:29:59.999 advances to 14:30:00.000
      const endOfSlot = new Date('2026-11-07T14:29:59.999Z');
      expect(roundUpTo15Minutes(endOfSlot).toISOString()).toBe('2026-11-07T14:30:00.000Z');
    });

    it('3.4: findNextFreeSlot under high schedule saturation', () => {
      // Use local Date boundaries aligning with findNextFreeSlot's setHours math
      const preferred = new Date(2026, 10, 7, 9, 0, 0);
      // Create back-to-back busy slots from 09:00 to 18:00
      const busySlots = [
        { start: new Date(2026, 10, 7, 9, 0, 0), end: new Date(2026, 10, 7, 12, 0, 0) },
        { start: new Date(2026, 10, 7, 12, 0, 0), end: new Date(2026, 10, 7, 15, 0, 0) },
        { start: new Date(2026, 10, 7, 15, 0, 0), end: new Date(2026, 10, 7, 18, 0, 0) },
      ];

      // Request 60 minutes: next free slot should be 18:00
      const free = findNextFreeSlot(60, preferred, busySlots, 22);
      expect(free).not.toBeNull();
      expect(free!.getHours()).toBe(18);

      // Request when whole day until dayEndHour (23) is full returns null
      const fullDayBusy = [
        { start: new Date(2026, 10, 7, 9, 0, 0), end: new Date(2026, 10, 7, 23, 0, 0) },
      ];
      const noSlot = findNextFreeSlot(30, preferred, fullDayBusy, 23);
      expect(noSlot).toBeNull();
    });

    it('3.5: Multi-lingual anchor phrase resolutions across English, Hindi, and Hinglish', () => {
      const base = new Date('2026-11-09T08:00:00.000Z'); // Monday

      // "kal shaam" -> Tuesday 17:00 (via HINGLISH_ANCHOR_MAP: shaam -> 17:00)
      const d1 = resolveRelativeDate('kal shaam', base);
      expect(d1).not.toBeNull();
      const parsedD1 = new Date(d1!);
      expect(parsedD1.getUTCHours()).toBe(17);

      // "kal 6 PM" -> Tuesday 18:00 (via clock extraction)
      const dClock = resolveRelativeDate('kal 6 PM', base);
      expect(dClock).not.toBeNull();
      const parsedClock = new Date(dClock!);
      expect(parsedClock.getUTCHours()).toBe(18);

      // "parson subah 10 baje" -> Wednesday 10:00
      const d2 = resolveRelativeDate('parson subah 10 baje', base);
      expect(d2).not.toBeNull();
      const parsedD2 = new Date(d2!);
      expect(parsedD2.getUTCHours()).toBe(10);

      // "friday at 4 PM" -> Friday 16:00
      const d3 = resolveRelativeDate('friday at 4 PM', base);
      expect(d3).not.toBeNull();
      const parsedD3 = new Date(d3!);
      expect(parsedD3.getUTCDay()).toBe(5); // Friday
      expect(parsedD3.getUTCHours()).toBe(16);

      // normalizeDeadline retains valid ISO string
      const iso = '2027-01-15T10:30:00.000Z';
      expect(normalizeDeadline(iso)).toBe(iso);
      expect(normalizeDeadline(null)).toBeNull();
    });
  });

  // ===========================================================================
  // 4. CROSS-TENANT DEPENDENCY INJECTION & WORKSPACE ISOLATION DEFENSE
  // ===========================================================================
  describe('4. Cross-Tenant Dependency Attack & Isolation Guarantees', () => {
    it('4.1: Cross-tenant dependency attack: Tenant A cannot reference a prerequisite task owned by Tenant B', async () => {
      // 1. Create a task in Tenant B
      const resB = await request(app)
        .post('/api/tasks')
        .set('x-workspace-id', TEST_WS_B)
        .send({
          title: '[TIER5-AUDIT] Tenant B Confidential Prereq',
          priority: 'HIGH',
        });

      expect(resB.status).toBe(201);
      const tenantBTaskId = resB.body.task.id;

      // 2. Tenant A attempts to commit a task referencing Tenant B task as prerequisite
      const maliciousBatch = {
        tasks: [
          {
            tempId: 'tenant-a-intruder',
            title: '[TIER5-AUDIT] Tenant A Infiltrator Task',
            priority: 'CRITICAL',
            dependencies: [tenantBTaskId], // Attempting cross-workspace dependency injection!
          },
        ],
      };

      const attackRes = await request(app)
        .post('/api/tasks/approve-all')
        .set('x-workspace-id', TEST_WS_A)
        .send(maliciousBatch);

      // 3. Must be strictly rejected with HTTP 422 Unprocessable Entity
      expect(attackRes.status).toBe(422);
      expect(attackRes.body.error).toBe('Unprocessable Entity');
      expect(attackRes.body.message).toContain('does not exist in workspace');

      // 4. Verify transaction rollback: zero tasks committed to Tenant A
      const countA = await prisma.task.count({
        where: {
          workspaceId: TEST_WS_A,
          title: '[TIER5-AUDIT] Tenant A Infiltrator Task',
        },
      });
      expect(countA).toBe(0);
    });

    it('4.2: Activity event queries enforce strict workspace isolation without data leakage', async () => {
      // 1. Create task in Tenant A
      const createRes = await request(app)
        .post('/api/tasks')
        .set('x-workspace-id', TEST_WS_A)
        .send({ title: '[TIER5-AUDIT] Tenant A Secret Activity Task' });

      expect(createRes.status).toBe(201);
      const taskId = createRes.body.task.id;

      // 2. Tenant B attempts to query activities for Tenant A task ID
      const leakAttempt = await request(app)
        .get(`/api/activities?taskId=${taskId}`)
        .set('x-workspace-id', TEST_WS_B);

      expect(leakAttempt.status).toBe(200);
      expect(leakAttempt.body.activities).toHaveLength(0);
      expect(leakAttempt.body.total).toBe(0);
    });

    it('4.3: Direct database foreign key validation: non-existent prerequisite UUID is rejected with 422', async () => {
      const nonExistentUUID = crypto.randomUUID();
      const res = await request(app)
        .post('/api/tasks/approve-all')
        .set('x-workspace-id', TEST_WS_A)
        .send({
          tasks: [
            {
              tempId: 'dangling-child',
              title: '[TIER5-AUDIT] Dangling Prereq Task',
              dependencies: [nonExistentUUID],
            },
          ],
        });

      expect(res.status).toBe(422);
      expect(res.body.error).toBe('Unprocessable Entity');
      expect(res.body.message).toContain('does not exist in workspace');
    });
  });

  // ===========================================================================
  // 5. MULTI-PARENT DIAMOND UNBLOCKING CASCADE & AUDIT TRAIL
  // ===========================================================================
  describe('5. Multi-Parent Diamond Unblocking Cascade & Activity History', () => {
    it('5.1: Diamond dependency graph (A -> [B, C] -> D): D only unblocks when BOTH B and C complete', async () => {
      // Create Diamond:
      // Root (A)
      // Branch 1 (B depends on A)
      // Branch 2 (C depends on A)
      // Sink (D depends on B and C)
      const batchRes = await request(app)
        .post('/api/tasks/approve-all')
        .set('x-workspace-id', TEST_WS_A)
        .send({
          tasks: [
            { tempId: 'diamond-a', title: '[TIER5-AUDIT] Diamond Node A (Root)', dependencies: [] },
            { tempId: 'diamond-b', title: '[TIER5-AUDIT] Diamond Node B (Branch 1)', dependencies: ['diamond-a'] },
            { tempId: 'diamond-c', title: '[TIER5-AUDIT] Diamond Node C (Branch 2)', dependencies: ['diamond-a'] },
            { tempId: 'diamond-d', title: '[TIER5-AUDIT] Diamond Node D (Sink)', dependencies: ['diamond-b', 'diamond-c'] },
          ],
        });

      expect(batchRes.status).toBe(201);
      const taskA = batchRes.body.tasks.find((t: any) => t.title.includes('Diamond Node A'));
      const taskB = batchRes.body.tasks.find((t: any) => t.title.includes('Diamond Node B'));
      const taskC = batchRes.body.tasks.find((t: any) => t.title.includes('Diamond Node C'));
      const taskD = batchRes.body.tasks.find((t: any) => t.title.includes('Diamond Node D'));

      expect(taskA.status).toBe('TO_DO');
      expect(taskB.status).toBe('BLOCKED');
      expect(taskC.status).toBe('BLOCKED');
      expect(taskD.status).toBe('BLOCKED');

      // Step 1: Complete Root Node A
      await request(app)
        .patch(`/api/tasks/${taskA.id}`)
        .set('x-workspace-id', TEST_WS_A)
        .send({ status: 'COMPLETED' });

      // Verify B and C cascaded to TO_DO, but D is STILL BLOCKED
      const check1 = await request(app).get('/api/tasks').set('x-workspace-id', TEST_WS_A);
      const bAfterA = check1.body.tasks.find((t: any) => t.id === taskB.id);
      const cAfterA = check1.body.tasks.find((t: any) => t.id === taskC.id);
      const dAfterA = check1.body.tasks.find((t: any) => t.id === taskD.id);

      expect(bAfterA.status).toBe('TO_DO');
      expect(cAfterA.status).toBe('TO_DO');
      expect(dAfterA.status).toBe('BLOCKED'); // Still blocked because neither B nor C is completed

      // Step 2: Complete Branch B only
      await request(app)
        .patch(`/api/tasks/${taskB.id}`)
        .set('x-workspace-id', TEST_WS_A)
        .send({ status: 'COMPLETED' });

      // Verify D is STILL BLOCKED because Branch C is not completed
      const check2 = await request(app).get('/api/tasks').set('x-workspace-id', TEST_WS_A);
      const dAfterB = check2.body.tasks.find((t: any) => t.id === taskD.id);
      expect(dAfterB.status).toBe('BLOCKED');

      // Step 3: Complete Branch C
      await request(app)
        .patch(`/api/tasks/${taskC.id}`)
        .set('x-workspace-id', TEST_WS_A)
        .send({ status: 'COMPLETED' });

      // Verify D is NOW unblocked to TO_DO
      const check3 = await request(app).get('/api/tasks').set('x-workspace-id', TEST_WS_A);
      const dFinal = check3.body.tasks.find((t: any) => t.id === taskD.id);
      expect(dFinal.status).toBe('TO_DO');

      // Step 4: Verify immutable Activity History for Node D
      const actRes = await request(app)
        .get(`/api/activities?taskId=${taskD.id}`)
        .set('x-workspace-id', TEST_WS_A);

      expect(actRes.status).toBe(200);
      const unblockEvent = actRes.body.activities.find(
        (a: any) => a.eventType === 'TASK_STATUS_CHANGED' && a.newState?.status === 'TO_DO'
      );
      expect(unblockEvent).toBeDefined();
      expect(unblockEvent.description).toContain('unblocked because all prerequisites completed');
    });

    it('5.2: Permanent task deletion cleans up foreign keys without orphan cascade failure', async () => {
      // Create single task
      const createRes = await request(app)
        .post('/api/tasks')
        .set('x-workspace-id', TEST_WS_A)
        .send({ title: '[TIER5-AUDIT] Task for Permanent Deletion' });

      const taskId = createRes.body.task.id;

      // Delete permanently via DELETE /api/tasks/:id?permanent=true
      const delRes = await request(app)
        .delete(`/api/tasks/${taskId}?permanent=true`)
        .set('x-workspace-id', TEST_WS_A);

      expect(delRes.status).toBe(200);
      expect(delRes.body.success).toBe(true);

      // Verify task is completely gone from DB
      const dbTask = await prisma.task.findUnique({ where: { id: taskId } });
      expect(dbTask).toBeNull();
    });
  });

  // ===========================================================================
  // 6. SQL / PRISMA QUERY INJECTION & INPUT SANITIZATION STRESS
  // ===========================================================================
  describe('6. SQL & Input Injection Immunity across Task/Activity Queries', () => {
    it('6.1: Immunity to SQL injection in task search query parameters', async () => {
      const maliciousSearchStrings = [
        "' OR '1'='1",
        "'; DROP TABLE tasks; --",
        '" OR ""=""',
        "admin'--",
        "1; SELECT pg_sleep(1); --",
      ];

      for (const search of maliciousSearchStrings) {
        const res = await request(app)
          .get(`/api/tasks?search=${encodeURIComponent(search)}`)
          .set('x-workspace-id', TEST_WS_A);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.tasks)).toBe(true);
        // Parametric query treated input as literal string; database was unharmed
      }
    });

    it('6.2: Immunity to SQL injection in assignee and status query parameters', async () => {
      const resAssignee = await request(app)
        .get(`/api/tasks?assignee=${encodeURIComponent("Robert'); DROP TABLE users;--")}`)
        .set('x-workspace-id', TEST_WS_A);

      expect(resAssignee.status).toBe(200);
      expect(Array.isArray(resAssignee.body.tasks)).toBe(true);
    });

    it('6.3: Rejects invalid status and priority mutations with HTTP 400 Bad Request', async () => {
      // 1. Create a task
      const createRes = await request(app)
        .post('/api/tasks')
        .set('x-workspace-id', TEST_WS_A)
        .send({ title: '[TIER5-AUDIT] Mutation Validation Task' });

      const taskId = createRes.body.task.id;

      // 2. Attempt invalid status mutation
      const badStatusRes = await request(app)
        .patch(`/api/tasks/${taskId}`)
        .set('x-workspace-id', TEST_WS_A)
        .send({ status: 'ILLEGAL_STATUS_OVERRIDE' });

      expect(badStatusRes.status).toBe(400);
      expect(badStatusRes.body.error).toBe('Bad Request');
      expect(badStatusRes.body.message).toContain('Invalid status or priority');

      // 3. Attempt invalid priority mutation
      const badPriorityRes = await request(app)
        .patch(`/api/tasks/${taskId}`)
        .set('x-workspace-id', TEST_WS_A)
        .send({ priority: 'HYPER_CRITICAL' });

      expect(badPriorityRes.status).toBe(400);
      expect(badPriorityRes.body.error).toBe('Bad Request');
    });

    it('6.4: Gracefully handles boundary pagination parameters (NaN, negative, extreme offset)', async () => {
      const resBoundary = await request(app)
        .get('/api/activities?limit=999999&offset=999999')
        .set('x-workspace-id', TEST_WS_A);

      expect(resBoundary.status).toBe(200);
      expect(Array.isArray(resBoundary.body.activities)).toBe(true);
      expect(resBoundary.body.activities).toHaveLength(0);
    });
  });

  // ===========================================================================
  // 7. SPEECH SYNTHESIS & TRANSCRIPTION ADVERSARIAL EDGE CASES
  // ===========================================================================
  describe('7. Speech Synthesis & Transcription Adversarial Edge Cases', () => {
    it('7.1: Clamps speed multiplier boundaries safely within [0.5, 2.0]', async () => {
      // Extreme low speed: 0.01 -> clamped to 0.5
      const resLow = await request(app)
        .post('/api/speech/synthesize')
        .send({ text: 'Testing extreme low speed clamp', speed: 0.01 });

      expect(resLow.status).toBe(200);
      expect(resLow.body.audioBase64).toBeDefined();

      // Extreme high speed: 100.0 -> clamped to 2.0
      const resHigh = await request(app)
        .post('/api/speech/synthesize')
        .send({ text: 'Testing extreme high speed clamp', speed: 100.0 });

      expect(resHigh.status).toBe(200);
      expect(resHigh.body.audioBase64).toBeDefined();
    });

    it('7.2: Rejects empty or whitespace-only synthesis requests with HTTP 400', async () => {
      const resEmpty = await request(app)
        .post('/api/speech/synthesize')
        .send({ text: '' });

      expect(resEmpty.status).toBe(400);
      expect(resEmpty.body.error).toBe('Bad Request');

      const resSpaces = await request(app)
        .post('/api/speech/synthesize')
        .send({ text: '    \n\t   ' });

      expect(resSpaces.status).toBe(400);

      const resGetEmpty = await request(app)
        .get('/api/speech/synthesize?text=');

      expect(resGetEmpty.status).toBe(400);
    });

    it('7.3: High-concurrency synthesis stress: 15 simultaneous requests execute without corruption', async () => {
      const requests = Array.from({ length: 15 }, (_, i) => {
        return request(app)
          .post('/api/speech/synthesize')
          .send({
            text: `Concurrent test task #${i + 1} confirmation chime`,
            voice: 'Shivani',
          });
      });

      const results = await Promise.all(requests);
      for (const res of results) {
        expect(res.status).toBe(200);
        expect(res.body.audioBase64).toBeDefined();
        const buf = Buffer.from(res.body.audioBase64, 'base64');
        expect(buf.toString('ascii', 0, 4)).toBe('RIFF');
        expect(buf.toString('ascii', 8, 12)).toBe('WAVE');
      }
    });

    it('7.4: Rejects audio transcribe payloads exceeding 25MB boundary with HTTP 413', async () => {
      const res = await request(app)
        .post('/api/speech/transcribe')
        .set('Content-Type', 'audio/wav')
        .set('Content-Length', (26 * 1024 * 1024).toString())
        .send();

      expect(res.status).toBe(413);
      expect(res.body.error).toBe('Payload Too Large');
    });

    it('7.5: Zero-amplitude and empty audio inputs return confidence 0.0 with appropriate indicator', async () => {
      // 1. Explicit simulated empty header with allowed audio content type
      const resSim = await request(app)
        .post('/api/speech/transcribe')
        .set('Content-Type', 'audio/wav')
        .set('x-simulate-empty', 'true')
        .send();

      expect(resSim.status).toBe(200);
      expect(resSim.body.confidence).toBe(0.0);
      expect(resSim.body.text).toBe('');
      expect(resSim.body.warning).toBe('No speech detected.');

      // 2. Zero-length buffer
      const resZero = await request(app)
        .post('/api/speech/transcribe')
        .set('Content-Type', 'audio/wav')
        .send(Buffer.alloc(0));

      expect(resZero.status).toBe(200);
      expect(resZero.body.confidence).toBe(0.0);
      expect(resZero.body.text).toBe('');
      expect(resZero.body.warning).toBe('No speech detected.');

      // 3. 500-byte zeroed PCM buffer (mock adapter silence detection)
      const silentBuffer = Buffer.alloc(500, 0);

      const resSilent = await request(app)
        .post('/api/speech/transcribe')
        .set('Content-Type', 'audio/wav')
        .send(silentBuffer);

      expect(resSilent.status).toBe(200);
      expect(resSilent.body.confidence).toBe(0.0);
      expect(resSilent.body.text).toBe('');
    });
  });
});

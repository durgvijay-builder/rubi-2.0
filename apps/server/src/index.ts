import './loadEnv.js';
import express, { type Express } from 'express';
import cors from 'cors';
import { workspaceAuth } from './middleware/workspaceAuth.js';
import { errorHandler } from './middleware/errorHandler.js';
import { rateLimiter } from './middleware/rateLimiter.js';
import { speechRoutes } from './routes/speechRoutes.js';
import { extractionRoutes } from './routes/extractionRoutes.js';
import { taskRoutes } from './routes/taskRoutes.js';
import { activityRoutes } from './routes/activityRoutes.js';
import { categoryRoutes } from './routes/categoryRoutes.js';
import { settingsRoutes } from './routes/settingsRoutes.js';
import { reminderRoutes } from './routes/reminderRoutes.js';
import { routineRoutes } from './routes/routineRoutes.js';
import { providerStatusService } from './services/providerStatusService.js';
import { reminderService } from './services/reminderService.js';

export const app: Express = express();
const port = parseInt(process.env.PORT || '3001', 10);

app.use(cors());
app.use(express.json({ limit: '30mb' }));

// Public health & provider status endpoints
app.get('/api/health', async (_req, res) => {
  const current = providerStatusService.getStatus();
  res.json({
    status: current.overallStatus === 'offline' ? 'ok' : current.overallStatus,
    timestamp: current.timestamp,
    uptime: current.uptime,
    mode: current.mode,
    providers: {
      database: current.database,
      stt: current.stt,
      gemini: current.gemini,
      tts: current.tts,
    },
  });
});

app.get('/api/health/providers', async (req, res) => {
  if (req.query.verify === 'true') {
    const verified = await providerStatusService.verifyAll();
    res.json(verified);
    return;
  }
  res.json(providerStatusService.getStatus());
});

app.post('/api/health/verify-providers', async (_req, res) => {
  const verified = await providerStatusService.verifyAll();
  res.json(verified);
});

// Protected workspace verification endpoint
app.get('/api/workspace', workspaceAuth, (req, res) => {
  res.json({
    workspace: req.workspace,
  });
});

// Speech pipeline endpoints (STT & TTS)
app.use('/api/speech', rateLimiter, speechRoutes);
app.post('/api/transcribe', rateLimiter, (req, res, next) => {
  req.url = '/transcribe';
  speechRoutes(req, res, next);
});
app.post('/api/tts', rateLimiter, (req, res, next) => {
  req.url = '/synthesize';
  speechRoutes(req, res, next);
});

// Semantic extraction endpoints (M4)
app.use('/api/extract', rateLimiter, extractionRoutes);
app.use('/api/ai/extract', rateLimiter, extractionRoutes);

// Task management endpoints (M5)
app.use('/api/tasks', taskRoutes);

// Personal task categories endpoints
app.use('/api/categories', categoryRoutes);

// User settings & personalization endpoints
app.use('/api/user-settings', settingsRoutes);

// Reminders & push notification endpoints
app.use('/api/reminders', reminderRoutes);

// Routines & recurring habit tracking endpoints
app.use('/api/routines', workspaceAuth, routineRoutes);

// Activity logging endpoints (M5)
app.use('/api/activity', activityRoutes);
app.use('/api/activities', activityRoutes);

// Global error handling
app.use(errorHandler);

// Only listen if executed directly
if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`[R.U.B.I. 2.0 Server] listening on port ${port} (mode: ${process.env.RUBI_MODE || 'offline'})`);

    // Start background reminder scheduler
    reminderService.startScheduler();

    // Run initial provider verification asynchronously
    providerStatusService.verifyAll().catch((err) => {
      console.warn('[R.U.B.I. 2.0 Server] Initial provider verification error:', err.message);
    });
  });
}

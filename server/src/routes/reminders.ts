import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { computeReminderTasks, sendReminderBatch, sendReminderTask } from '../services/reminderService';
import { z } from 'zod';
import { generateWhatsAppSummary } from '../services/aiService';
import { prisma } from '../config/db';

export const reminderRouter = Router();

reminderRouter.use(authMiddleware);

reminderRouter.get('/api/reminders/tasks', async (_req, res, next) => {
  try {
    const tasks = await computeReminderTasks();
    res.json(tasks);
  } catch (error) {
    next(error);
  }
});

reminderRouter.post('/api/reminders/send', async (req, res, next) => {
  try {
    const schema = z.object({
      taskId: z.string(),
      customInstructions: z.string().optional()
    });
    const { taskId, customInstructions } = schema.parse(req.body);
    const tasks = await computeReminderTasks();
    const task = tasks.find((t) => t.id === taskId);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }
    const result = await sendReminderTask(task, customInstructions);
    res.json({ success: result.result.success, method: result.result.method, task: result.task, emailLogId: result.emailLog.id });
  } catch (error) {
    next(error);
  }
});

reminderRouter.post('/api/reminders/send-batch', async (req, res, next) => {
  try {
    const schema = z.object({ taskIds: z.array(z.string()), customInstructions: z.string().optional() });
    const { taskIds, customInstructions } = schema.parse(req.body);
    const tasks = await computeReminderTasks();
    const filtered = tasks.filter((task) => taskIds.includes(task.id));
    const summary = await sendReminderBatch(filtered, customInstructions);
    res.json(summary);
  } catch (error) {
    next(error);
  }
});

reminderRouter.post('/api/reminders/whatsapp-summary', async (req, res, next) => {
  try {
    const schema = z.object({ taskIds: z.array(z.string()).optional() });
    const { taskIds } = schema.parse(req.body ?? {});
    const tasks = await computeReminderTasks();
    const filtered = taskIds?.length ? tasks.filter((task) => taskIds.includes(task.id)) : tasks;
    const summaryText = await generateWhatsAppSummary(filtered);
    res.json({ summaryText });
  } catch (error) {
    next(error);
  }
});

reminderRouter.get('/api/reminders/logs', async (req, res, next) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
    
    const logs = await prisma.emailLog.findMany({
      take: limit,
      orderBy: { sentAt: 'desc' },
      include: {
        subscriber: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    // Transform to match frontend expected format
    const formattedLogs = logs.map(log => ({
      id: log.id,
      subscriberId: log.subscriberId,
      type: log.type,
      subject: log.subject,
      body: log.body,
      method: log.method,
      success: log.success,
      error: log.error,
      sentAt: log.sentAt.toISOString(),
      subscriber: log.subscriber ? {
        id: log.subscriber.id,
        name: log.subscriber.name,
        email: log.subscriber.email
      } : undefined
    }));

    res.json(formattedLogs);
  } catch (error) {
    next(error);
  }
});

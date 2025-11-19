import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { computeReminderTasks, sendReminderBatch, sendReminderTask } from '../services/reminderService';
import { z } from 'zod';
import { generateWhatsAppSummary } from '../services/aiService';

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

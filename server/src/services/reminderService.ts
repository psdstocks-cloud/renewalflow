import { differenceInCalendarDays, isAfter } from 'date-fns';
import { prisma } from '../config/db';
import { ReminderTask, ReminderType } from '../types/index';
import { getSettings } from './settingsService';
import { generateReminderEmail } from './aiService';
import { sendTrackedEmail } from './emailService';

function buildTask(subscriber: any, type: ReminderType, daysUntilExpiry: number, reason: string): ReminderTask {
  return {
    id: `${subscriber.id}_${type}`,
    subscriberId: subscriber.id,
    type,
    daysUntilExpiry,
    reason,
    subscriber
  };
}

export async function computeReminderTasks(referenceDate = new Date()): Promise<ReminderTask[]> {
  const { reminderConfig } = await getSettings();
  const subscribers = await prisma.subscriber.findMany({ where: { status: 'ACTIVE' } });
  const tasks: ReminderTask[] = [];

  for (const subscriber of subscribers) {
    const daysUntilExpiry = differenceInCalendarDays(subscriber.endDate, referenceDate);
    const lastNotified = subscriber.lastNotifiedAt;
    const alreadyNotifiedToday = lastNotified && !isAfter(referenceDate, lastNotified);

    if (!alreadyNotifiedToday && daysUntilExpiry === reminderConfig.firstReminderDays) {
      tasks.push(buildTask(subscriber, 'FIRST_REMINDER', daysUntilExpiry, 'First reminder based on settings'));
    }
    if (!alreadyNotifiedToday && daysUntilExpiry === reminderConfig.finalReminderDays) {
      tasks.push(buildTask(subscriber, 'FINAL_REMINDER', daysUntilExpiry, 'Final reminder before expiry'));
    }
    if (daysUntilExpiry < 0 && subscriber.status === 'ACTIVE') {
      tasks.push(buildTask(subscriber, 'EXPIRED', daysUntilExpiry, 'Subscription already expired'));
    }
  }

  return tasks;
}

export async function sendReminderTask(task: ReminderTask, customInstructions?: string) {
  if (!task.subscriber) {
    throw new Error('Task subscriber is required');
  }

  const { emailTemplate } = await getSettings();
  const { subject, body } = await generateReminderEmail(task, emailTemplate, customInstructions);

  // 1. Create EmailLog FIRST to get the ID for tracking
  const emailLog = await prisma.emailLog.create({
    data: {
      subscriberId: task.subscriber.id,
      workspaceId: task.subscriber.workspaceId,
      type: task.type,
      subject,
      body,
      method: 'SMTP',
      success: false, // Will update after sending
      error: undefined
    }
  });

  // 2. Send email WITH tracking (pixel + links)
  const emailResult = await sendTrackedEmail({
    to: task.subscriber.email,
    subject,
    html: body,
    emailLogId: emailLog.id
  });

  // 3. Update EmailLog with result
  await prisma.emailLog.update({
    where: { id: emailLog.id },
    data: {
      success: emailResult.success,
      error: emailResult.success ? undefined : emailResult.error
    }
  });

  // 4. Update subscriber's last notified timestamp
  await prisma.subscriber.update({
    where: { id: task.subscriber.id },
    data: { lastNotifiedAt: new Date() }
  });

  return { task, emailLog, result: emailResult };
}


export async function sendReminderBatch(tasks: ReminderTask[], customInstructions?: string) {
  const summary = { total: tasks.length, success: 0, failed: 0 };
  for (const task of tasks) {
    const response = await sendReminderTask(task, customInstructions);
    if (response.result.success) {
      summary.success += 1;
    } else {
      summary.failed += 1;
    }
  }
  return summary;
}

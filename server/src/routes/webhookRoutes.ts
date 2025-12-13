import express from 'express';
import { prisma } from '../config/db';
import { z } from 'zod';

const router = express.Router();

const pointChangeSchema = z.object({
    email: z.string().email(),
    points_balance: z.number(),
    change_amount: z.number(),
    description: z.string(),
    event_date: z.string().optional(), // ISO string
    external_id: z.string().optional(), // Log ID from WP
});

router.post('/woo/points', async (req, res) => {
    try {
        // Validate payload
        const payload = pointChangeSchema.parse(req.body);
        const { email, points_balance, change_amount, description, event_date, external_id } = payload;

        console.log(`[Webhook] Received points update for ${email}: ${change_amount} points`);

        // Find the subscriber (across all workspaces? Or assume email unique)
        // Email is unique globally in Subscriber model
        const subscriber = await prisma.subscriber.findUnique({
            where: { email },
        });

        if (!subscriber) {
            console.warn(`[Webhook] Subscriber not found for email: ${email}`);
            return res.status(404).json({ error: 'Subscriber not found' });
        }

        // Update Subscriber Balance
        await prisma.subscriber.update({
            where: { id: subscriber.id },
            data: {
                pointsRemaining: points_balance, // Sync exact balance from source of truth
            },
        });

        // Log History
        // Check if externalId exists to prevent dupes
        if (external_id) {
            const existingLog = await prisma.pointHistory.findUnique({
                where: { externalId: external_id }
            });
            if (existingLog) {
                return res.status(200).json({ message: 'Log already exists' });
            }
        }

        await prisma.pointHistory.create({
            data: {
                subscriberId: subscriber.id,
                change: change_amount,
                reason: description,
                date: event_date ? new Date(event_date) : new Date(),
                externalId: external_id
            },
        });

        res.status(200).json({ success: true });
    } catch (err: any) {
        console.error('[Webhook] Error processing request:', err);
        res.status(400).json({ error: err.message || 'Invalid Request' });
    }
});

export default router;

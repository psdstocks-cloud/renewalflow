import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { prisma } from '../config/db';

export const emailsRouter = Router();

emailsRouter.use(authMiddleware);

/**
 * GET /api/emails
 * List all sent emails with pagination and tracking stats
 */
emailsRouter.get('/api/emails', async (req: Request, res: Response, next) => {
    try {
        const user = (req as any).user;
        const workspaceUser = await prisma.workspaceUser.findFirst({ where: { userId: user.id } });
        if (!workspaceUser) {
            return res.status(404).json({ message: 'Workspace not found' });
        }

        // Pagination params
        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
        const skip = (page - 1) * limit;

        // Optional filters
        const type = req.query.type as string | undefined;
        const success = req.query.success === 'true' ? true : req.query.success === 'false' ? false : undefined;
        const subscriberId = req.query.subscriberId as string | undefined;

        const where: any = {
            workspaceId: workspaceUser.workspaceId,
            ...(type && { type }),
            ...(success !== undefined && { success }),
            ...(subscriberId && { subscriberId })
        };

        // Get total count for pagination
        const totalCount = await prisma.emailLog.count({ where });

        // Get emails with subscriber info
        const emails = await prisma.emailLog.findMany({
            where,
            take: limit,
            skip,
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

        // Format response with tracking status
        const formattedEmails = emails.map(email => ({
            id: email.id,
            type: email.type,
            subject: email.subject,
            // Don't send full body in list view for performance
            bodyPreview: email.body.substring(0, 200) + (email.body.length > 200 ? '...' : ''),
            method: email.method,
            success: email.success,
            error: email.error,
            sentAt: email.sentAt.toISOString(),

            // Tracking status
            tracking: {
                opened: !!email.openedAt,
                openedAt: email.openedAt?.toISOString() || null,
                clicked: !!email.clickedAt,
                clickedAt: email.clickedAt?.toISOString() || null,
                converted: !!email.convertedAt,
                convertedAt: email.convertedAt?.toISOString() || null
            },

            subscriber: email.subscriber ? {
                id: email.subscriber.id,
                name: email.subscriber.name,
                email: email.subscriber.email
            } : null
        }));

        res.json({
            emails: formattedEmails,
            pagination: {
                page,
                limit,
                totalCount,
                totalPages: Math.ceil(totalCount / limit),
                hasNext: page * limit < totalCount,
                hasPrev: page > 1
            }
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/emails/:id
 * Get single email with full body and tracking details
 */
emailsRouter.get('/api/emails/:id', async (req: Request, res: Response, next) => {
    try {
        const user = (req as any).user;
        const workspaceUser = await prisma.workspaceUser.findFirst({ where: { userId: user.id } });
        if (!workspaceUser) {
            return res.status(404).json({ message: 'Workspace not found' });
        }

        const email = await prisma.emailLog.findFirst({
            where: {
                id: req.params.id,
                workspaceId: workspaceUser.workspaceId
            },
            include: {
                subscriber: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        planName: true,
                        pointsRemaining: true
                    }
                }
            }
        });

        if (!email) {
            return res.status(404).json({ message: 'Email not found' });
        }

        res.json({
            id: email.id,
            type: email.type,
            subject: email.subject,
            body: email.body, // Full body for detail view
            method: email.method,
            success: email.success,
            error: email.error,
            sentAt: email.sentAt.toISOString(),

            tracking: {
                opened: !!email.openedAt,
                openedAt: email.openedAt?.toISOString() || null,
                clicked: !!email.clickedAt,
                clickedAt: email.clickedAt?.toISOString() || null,
                converted: !!email.convertedAt,
                convertedAt: email.convertedAt?.toISOString() || null
            },

            subscriber: email.subscriber
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/emails/stats
 * Get aggregate email statistics
 */
emailsRouter.get('/api/emails/stats', async (req: Request, res: Response, next) => {
    try {
        const user = (req as any).user;
        const workspaceUser = await prisma.workspaceUser.findFirst({ where: { userId: user.id } });
        if (!workspaceUser) {
            return res.status(404).json({ message: 'Workspace not found' });
        }

        const workspaceId = workspaceUser.workspaceId;

        // Get counts using Prisma aggregations
        const [totalSent, successful, opened, clicked, converted] = await Promise.all([
            prisma.emailLog.count({ where: { workspaceId } }),
            prisma.emailLog.count({ where: { workspaceId, success: true } }),
            prisma.emailLog.count({ where: { workspaceId, openedAt: { not: null } } }),
            prisma.emailLog.count({ where: { workspaceId, clickedAt: { not: null } } }),
            prisma.emailLog.count({ where: { workspaceId, convertedAt: { not: null } } })
        ]);

        const openRate = successful > 0 ? (opened / successful) * 100 : 0;
        const clickRate = opened > 0 ? (clicked / opened) * 100 : 0;
        const conversionRate = clicked > 0 ? (converted / clicked) * 100 : 0;

        res.json({
            totalSent,
            successful,
            failed: totalSent - successful,
            opened,
            clicked,
            converted,
            rates: {
                delivery: totalSent > 0 ? (successful / totalSent) * 100 : 0,
                open: openRate,
                click: clickRate,
                conversion: conversionRate
            }
        });
    } catch (error) {
        next(error);
    }
});

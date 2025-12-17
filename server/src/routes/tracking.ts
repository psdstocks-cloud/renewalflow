import { Router, Request, Response } from 'express';
import { prisma } from '../config/db';
import crypto from 'crypto';

export const trackingRouter = Router();

// 1x1 transparent GIF (base64 decoded)
const TRACKING_PIXEL = Buffer.from(
    'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
    'base64'
);

/**
 * Track email open via 1x1 pixel
 * GET /track/open/:emailLogId
 */
trackingRouter.get('/track/open/:emailLogId', async (req: Request, res: Response) => {
    const { emailLogId } = req.params;

    try {
        // Update the email log with open timestamp (only if not already opened)
        await prisma.emailLog.updateMany({
            where: {
                id: emailLogId,
                openedAt: null // Only update if not already opened
            },
            data: {
                openedAt: new Date()
            }
        });

        console.log(`[Tracking] Email opened: ${emailLogId}`);
    } catch (error) {
        // Silently fail - don't break email viewing
        console.error('[Tracking] Open tracking error:', error);
    }

    // Always return the pixel regardless of tracking success
    res.set({
        'Content-Type': 'image/gif',
        'Content-Length': TRACKING_PIXEL.length,
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
    });
    res.send(TRACKING_PIXEL);
});

/**
 * Track link click and redirect
 * GET /track/click/:emailLogId/:linkHash
 * The linkHash is a URL-safe base64 encoded original URL
 */
trackingRouter.get('/track/click/:emailLogId/:linkHash', async (req: Request, res: Response) => {
    const { emailLogId, linkHash } = req.params;

    let originalUrl = 'https://example.com'; // Fallback

    try {
        // Decode the original URL
        originalUrl = Buffer.from(linkHash, 'base64url').toString('utf-8');

        // Update the email log with click timestamp (only if not already clicked)
        await prisma.emailLog.updateMany({
            where: {
                id: emailLogId,
                clickedAt: null // Only update first click
            },
            data: {
                clickedAt: new Date()
            }
        });

        console.log(`[Tracking] Link clicked: ${emailLogId} -> ${originalUrl}`);
    } catch (error) {
        console.error('[Tracking] Click tracking error:', error);
    }

    // Redirect to the original URL
    res.redirect(302, originalUrl);
});

/**
 * Mark email as converted (e.g., when user renews subscription)
 * POST /track/convert/:emailLogId
 * This can be called by webhooks or manually
 */
trackingRouter.post('/track/convert/:emailLogId', async (req: Request, res: Response) => {
    const { emailLogId } = req.params;

    try {
        const updated = await prisma.emailLog.update({
            where: { id: emailLogId },
            data: { convertedAt: new Date() }
        });

        console.log(`[Tracking] Conversion recorded: ${emailLogId}`);
        res.json({ success: true, emailLogId, convertedAt: updated.convertedAt });
    } catch (error) {
        console.error('[Tracking] Conversion tracking error:', error);
        res.status(404).json({ success: false, error: 'Email log not found' });
    }
});

// Helper functions for use in emailService
export function generateTrackingPixelUrl(emailLogId: string, baseUrl: string): string {
    return `${baseUrl}/track/open/${emailLogId}`;
}

export function generateTrackedLinkUrl(emailLogId: string, originalUrl: string, baseUrl: string): string {
    const linkHash = Buffer.from(originalUrl, 'utf-8').toString('base64url');
    return `${baseUrl}/track/click/${emailLogId}/${linkHash}`;
}

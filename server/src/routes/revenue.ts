import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { prisma } from '../config/db';
import { subDays, startOfMonth, endOfMonth } from 'date-fns';

export const revenueRouter = Router();
revenueRouter.use(authMiddleware);

// Helper to get workspace ID from authenticated user
async function getWorkspaceId(req: any): Promise<string> {
  const user = req.user;
  if (!user || !user.id) {
    throw new Error('User not authenticated');
  }
  
  const workspaceUser = await prisma.workspaceUser.findFirst({
    where: { userId: user.id },
  });
  
  if (!workspaceUser) {
    throw new Error('Workspace not found for user');
  }
  
  return workspaceUser.workspaceId;
}

// Overall revenue metrics
revenueRouter.get('/api/revenue/metrics', async (req, res, next) => {
  try {
    const workspaceId = await getWorkspaceId(req);
    const { startDate, endDate } = req.query;
    
    const start = startDate ? new Date(startDate as string) : startOfMonth(new Date());
    const end = endDate ? new Date(endDate as string) : endOfMonth(new Date());
    
    // Get all metrics in parallel
    const [
      totalRevenue,
      recoveredRevenue,
      mrrData,
      churnData,
      forecastData,
      byPlan,
      byMethod,
    ] = await Promise.all([
      // Total revenue
      prisma.revenueTransaction.aggregate({
        where: {
          workspaceId,
          transactionDate: { gte: start, lte: end },
          paymentStatus: 'completed',
        },
        _sum: { amount: true },
        _count: { id: true },
      }),
      // Recovered revenue
      prisma.revenueTransaction.aggregate({
        where: {
          workspaceId,
          transactionDate: { gte: start, lte: end },
          emailLogId: { not: null },
          paymentStatus: 'completed',
          transactionType: 'renewal',
        },
        _sum: { amount: true },
      }),
      // MRR/ARR
      (async () => {
        const activeSubscribers = await prisma.subscriber.findMany({
          where: { workspaceId, status: 'ACTIVE' },
          select: { amount: true },
        });
        const mrr = activeSubscribers.reduce((sum, sub) => sum + sub.amount, 0);
        return { mrr, arr: mrr * 12 };
      })(),
      // Churn
      (async () => {
        const churned = await prisma.subscriber.findMany({
          where: {
            workspaceId,
            status: 'EXPIRED',
            endDate: { gte: start, lte: end },
          },
          select: { amount: true },
        });
        return { lost: churned.reduce((sum, sub) => sum + sub.amount, 0) };
      })(),
      // Forecast
      (async () => {
        const endForecast = new Date();
        endForecast.setDate(endForecast.getDate() + 30);
        const expiring = await prisma.subscriber.findMany({
          where: {
            workspaceId,
            status: 'ACTIVE',
            endDate: { lte: endForecast, gte: new Date() },
          },
          select: { amount: true },
        });
        return { potentialRevenue: expiring.reduce((sum, sub) => sum + (sub.amount * 0.7), 0) };
      })(),
      // By plan
      prisma.revenueTransaction.groupBy({
        by: ['planName'],
        where: {
          workspaceId,
          transactionDate: { gte: start, lte: end },
          paymentStatus: 'completed',
        },
        _sum: { amount: true },
        _count: { id: true },
      }),
      // By payment method
      prisma.revenueTransaction.groupBy({
        by: ['paymentMethod'],
        where: {
          workspaceId,
          transactionDate: { gte: start, lte: end },
          paymentStatus: 'completed',
        },
        _sum: { amount: true },
        _count: { id: true },
      }),
    ]);
    
    res.json({
      totalRevenue: totalRevenue._sum.amount || 0,
      transactionCount: totalRevenue._count.id,
      recoveredRevenue: recoveredRevenue._sum.amount || 0,
      mrr: mrrData.mrr,
      arr: mrrData.arr,
      churnLost: churnData.lost,
      forecast: forecastData.potentialRevenue,
      byPlan: byPlan.map(item => ({
        planName: item.planName || 'Unknown',
        revenue: item._sum.amount || 0,
        transactionCount: item._count.id,
      })),
      byPaymentMethod: byMethod.map(item => ({
        paymentMethod: item.paymentMethod || 'Unknown',
        revenue: item._sum.amount || 0,
        transactionCount: item._count.id,
      })),
      period: { start: start.toISOString(), end: end.toISOString() },
    });
  } catch (error) {
    next(error);
  }
});

// Revenue recovery - revenue from reminders
revenueRouter.get('/api/revenue/recovery', async (req, res, next) => {
  try {
    const workspaceId = await getWorkspaceId(req);
    const { startDate, endDate } = req.query;
    
    const start = startDate ? new Date(startDate as string) : subDays(new Date(), 30);
    const end = endDate ? new Date(endDate as string) : new Date();
    
    const recovered = await prisma.revenueTransaction.aggregate({
      where: {
        workspaceId,
        transactionDate: { gte: start, lte: end },
        emailLogId: { not: null },
        paymentStatus: 'completed',
        transactionType: 'renewal',
      },
      _sum: { amount: true },
    });
    
    res.json({ recovered: recovered._sum.amount || 0 });
  } catch (error) {
    next(error);
  }
});

// MRR/ARR calculation
revenueRouter.get('/api/revenue/mrr', async (req, res, next) => {
  try {
    const workspaceId = await getWorkspaceId(req);
    const asOfDate = req.query.asOfDate ? new Date(req.query.asOfDate as string) : new Date();
    
    const activeSubscribers = await prisma.subscriber.findMany({
      where: {
        workspaceId,
        status: 'ACTIVE',
        endDate: { gte: asOfDate },
      },
      select: { amount: true },
    });
    
    const mrr = activeSubscribers.reduce((sum, sub) => sum + sub.amount, 0);
    const arr = mrr * 12;
    
    res.json({ mrr, arr });
  } catch (error) {
    next(error);
  }
});

// Churn revenue impact
revenueRouter.get('/api/revenue/churn', async (req, res, next) => {
  try {
    const workspaceId = await getWorkspaceId(req);
    const { startDate, endDate } = req.query;
    
    const start = startDate ? new Date(startDate as string) : subDays(new Date(), 30);
    const end = endDate ? new Date(endDate as string) : new Date();
    
    const churnedSubscribers = await prisma.subscriber.findMany({
      where: {
        workspaceId,
        status: 'EXPIRED',
        endDate: { gte: start, lte: end },
      },
      select: { amount: true },
    });
    
    const lost = churnedSubscribers.reduce((sum, sub) => sum + sub.amount, 0);
    
    res.json({ lost });
  } catch (error) {
    next(error);
  }
});

// Revenue by plan
revenueRouter.get('/api/revenue/by-plan', async (req, res, next) => {
  try {
    const workspaceId = await getWorkspaceId(req);
    const { startDate, endDate } = req.query;
    
    const start = startDate ? new Date(startDate as string) : subDays(new Date(), 30);
    const end = endDate ? new Date(endDate as string) : new Date();
    
    const revenueByPlan = await prisma.revenueTransaction.groupBy({
      by: ['planName'],
      where: {
        workspaceId,
        transactionDate: { gte: start, lte: end },
        paymentStatus: 'completed',
      },
      _sum: { amount: true },
      _count: { id: true },
    });
    
    res.json(revenueByPlan.map(item => ({
      planName: item.planName || 'Unknown',
      totalRevenue: item._sum.amount || 0,
      transactionCount: item._count.id,
    })));
  } catch (error) {
    next(error);
  }
});

// Payment method analytics
revenueRouter.get('/api/revenue/by-payment-method', async (req, res, next) => {
  try {
    const workspaceId = await getWorkspaceId(req);
    const { startDate, endDate } = req.query;
    
    const start = startDate ? new Date(startDate as string) : subDays(new Date(), 30);
    const end = endDate ? new Date(endDate as string) : new Date();
    
    const byMethod = await prisma.revenueTransaction.groupBy({
      by: ['paymentMethod'],
      where: {
        workspaceId,
        transactionDate: { gte: start, lte: end },
        paymentStatus: 'completed',
      },
      _sum: { amount: true },
      _count: { id: true },
    });
    
    res.json(byMethod.map(item => ({
      paymentMethod: item.paymentMethod || 'Unknown',
      totalRevenue: item._sum.amount || 0,
      transactionCount: item._count.id,
    })));
  } catch (error) {
    next(error);
  }
});

// Revenue forecast
revenueRouter.get('/api/revenue/forecast', async (req, res, next) => {
  try {
    const workspaceId = await getWorkspaceId(req);
    const daysAhead = req.query.days ? parseInt(req.query.days as string) : 30;
    const renewalRate = req.query.renewalRate ? parseFloat(req.query.renewalRate as string) : 0.7;
    
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + daysAhead);
    
    const expiringSubscribers = await prisma.subscriber.findMany({
      where: {
        workspaceId,
        status: 'ACTIVE',
        endDate: { lte: endDate, gte: new Date() },
      },
      select: { amount: true },
    });
    
    const potentialRevenue = expiringSubscribers.reduce((sum, sub) => sum + (sub.amount * renewalRate), 0);
    
    res.json({ 
      potentialRevenue,
      expiringCount: expiringSubscribers.length,
      renewalRate,
      daysAhead,
    });
  } catch (error) {
    next(error);
  }
});


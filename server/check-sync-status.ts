#!/usr/bin/env tsx
/**
 * Script to check if points balances have been synced from WordPress
 * Usage: npx tsx server/check-sync-status.ts [workspaceId]
 */

import { prisma } from './src/config/db';

async function checkSyncStatus(workspaceId?: string) {
  try {
    // Get tenant ID (workspaceId or default 'artly')
    const tenantId = workspaceId || 'artly';
    
    console.log('\n🔍 Checking sync status for tenant:', tenantId);
    console.log('=' .repeat(60));
    
    // Check wallet snapshots
    const totalSnapshots = await prisma.walletSnapshot.count({
      where: { tenantId },
    });
    
    const customersWithPoints = await prisma.walletSnapshot.count({
      where: {
        tenantId,
        pointsBalance: { gt: 0 },
      },
    });
    
    const totalPoints = await prisma.walletSnapshot.aggregate({
      where: { tenantId },
      _sum: { pointsBalance: true },
    });
    
    console.log('\n📊 Wallet Snapshots:');
    console.log(`  Total snapshots: ${totalSnapshots}`);
    console.log(`  Customers with points > 0: ${customersWithPoints}`);
    console.log(`  Total points: ${totalPoints._sum.pointsBalance ?? 0}`);
    
    // Get recent snapshots
    const recentSnapshots = await prisma.walletSnapshot.findMany({
      where: { tenantId },
      include: {
        customer: {
          select: {
            email: true,
            externalUserId: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    });
    
    if (recentSnapshots.length > 0) {
      console.log('\n📋 Recent snapshots (last 10):');
      recentSnapshots.forEach((snapshot, idx) => {
        console.log(`  ${idx + 1}. ${snapshot.customer.email} (WP ID: ${snapshot.customer.externalUserId}) - ${snapshot.pointsBalance} points (updated: ${snapshot.updatedAt.toISOString()})`);
      });
    }
    
    // Check customers
    const totalCustomers = await prisma.customer.count({
      where: { tenantId },
    });
    
    console.log('\n👥 Customers:');
    console.log(`  Total customers: ${totalCustomers}`);
    
    // Check subscribers (after sync from WordPress)
    const totalSubscribers = await prisma.subscriber.count();
    const subscribersWithPoints = await prisma.subscriber.count({
      where: {
        pointsRemaining: { gt: 0 },
      },
    });
    
    console.log('\n📧 Subscribers:');
    console.log(`  Total subscribers: ${totalSubscribers}`);
    console.log(`  Subscribers with points > 0: ${subscribersWithPoints}`);
    
    // Check if sync has happened recently
    const mostRecentSnapshot = await prisma.walletSnapshot.findFirst({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' },
    });
    
    if (mostRecentSnapshot) {
      const hoursAgo = (Date.now() - mostRecentSnapshot.updatedAt.getTime()) / (1000 * 60 * 60);
      console.log('\n⏰ Last sync:');
      console.log(`  Most recent update: ${mostRecentSnapshot.updatedAt.toISOString()}`);
      console.log(`  ${hoursAgo < 1 ? `${Math.round(hoursAgo * 60)} minutes ago` : `${hoursAgo.toFixed(1)} hours ago`}`);
    } else {
      console.log('\n⚠️  No snapshots found - sync may not have occurred yet');
    }
    
    console.log('\n' + '='.repeat(60));
    
    // Summary
    if (totalSnapshots === 0) {
      console.log('\n❌ No balances synced yet. Please run the sync from WordPress.');
    } else if (customersWithPoints === 0) {
      console.log('\n⚠️  Balances synced but all are zero. This might be expected if no users have points.');
    } else {
      console.log(`\n✅ Sync appears successful! Found ${customersWithPoints} customers with points.`);
      console.log(`   To see points in subscribers, click "Sync from WordPress" in the dashboard.`);
    }
    
  } catch (error: any) {
    console.error('\n❌ Error checking sync status:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Get workspaceId from command line args
const workspaceId = process.argv[2];
checkSyncStatus(workspaceId);


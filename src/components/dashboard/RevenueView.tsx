import React, { useEffect, useState } from 'react';
import { Card } from '@/src/components/ui/Card';
import { StatCard } from '@/src/components/dashboard/StatCard';
import { RevenueMetrics, RevenueByPlan, RevenueByPaymentMethod } from '@/src/types';
import { fetchRevenueMetrics, fetchRevenueByPlan, fetchRevenueByPaymentMethod } from '@/src/services/revenueService';
import { useLanguage } from '@/src/context/LanguageContext';

export const RevenueView: React.FC = () => {
  const { t } = useLanguage();
  const [isLoading, setIsLoading] = useState(true);
  const [metrics, setMetrics] = useState<RevenueMetrics | null>(null);
  const [byPlan, setByPlan] = useState<RevenueByPlan[]>([]);
  const [byPaymentMethod, setByPaymentMethod] = useState<RevenueByPaymentMethod[]>([]);
  const [dateRange, setDateRange] = useState<'month' | 'year' | 'all'>('month');

  useEffect(() => {
    loadRevenueData();
  }, [dateRange]);

  const loadRevenueData = async () => {
    setIsLoading(true);
    try {
      const startDate = getStartDate(dateRange);
      const endDate = new Date().toISOString();

      const [metricsData, planData, methodData] = await Promise.all([
        fetchRevenueMetrics(startDate, endDate),
        fetchRevenueByPlan(startDate, endDate),
        fetchRevenueByPaymentMethod(startDate, endDate),
      ]);

      setMetrics(metricsData);
      setByPlan(planData);
      setByPaymentMethod(methodData);
    } catch (err) {
      console.error('Failed to load revenue data', err);
    } finally {
      setIsLoading(false);
    }
  };

  const getStartDate = (range: 'month' | 'year' | 'all'): string => {
    const date = new Date();
    if (range === 'month') {
      date.setMonth(date.getMonth() - 1);
    } else if (range === 'year') {
      date.setFullYear(date.getFullYear() - 1);
    } else {
      // All time - use a very old date
      return new Date(2020, 0, 1).toISOString();
    }
    return date.toISOString();
  };

  const formatCurrency = (amount: number, currency: string = 'EGP') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Date Range Selector */}
      <div className="flex items-center gap-4 mb-6">
        <span className="text-zinc-400 text-sm">Period:</span>
        <div className="flex gap-2">
          {(['month', 'year', 'all'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                dateRange === range
                  ? 'bg-violet-500 text-white'
                  : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
              }`}
            >
              {range === 'month' ? 'Last Month' : range === 'year' ? 'Last Year' : 'All Time'}
            </button>
          ))}
        </div>
      </div>

      {/* Main Revenue Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          label="Total Revenue"
          value={metrics ? formatCurrency(metrics.totalRevenue) : '...'}
          icon="fa-dollar-sign"
          color="emerald"
          trend={`${metrics?.transactionCount || 0} transactions`}
          trendUp={true}
        />
        <StatCard
          label="MRR"
          value={metrics ? formatCurrency(metrics.mrr) : '...'}
          icon="fa-calendar-alt"
          color="violet"
          trend={`ARR: ${metrics ? formatCurrency(metrics.arr) : '...'}`}
          trendUp={true}
        />
        <StatCard
          label="Recovered Revenue"
          value={metrics ? formatCurrency(metrics.recoveredRevenue) : '...'}
          icon="fa-check-circle"
          color="cyan"
          trend="From reminders"
          trendUp={true}
        />
        <StatCard
          label="Churn Lost"
          value={metrics ? formatCurrency(metrics.churnLost) : '...'}
          icon="fa-user-times"
          color="rose"
          trend="Expired subscriptions"
          trendUp={false}
        />
      </div>

      {/* Forecast Card */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white">Revenue Forecast</h3>
        </div>
        <div className="text-3xl font-bold text-violet-400 mb-2">
          {metrics ? formatCurrency(metrics.forecast) : '...'}
        </div>
        <p className="text-zinc-400 text-sm">
          Potential revenue from upcoming renewals (next 30 days, 70% renewal rate)
        </p>
      </Card>

      {/* Revenue by Plan */}
      <Card>
        <h3 className="text-lg font-bold text-white mb-4">Revenue by Plan</h3>
        {isLoading ? (
          <div className="text-center py-8 text-zinc-500">
            <i className="fas fa-circle-notch fa-spin mr-2"></i> Loading...
          </div>
        ) : byPlan.length === 0 ? (
          <div className="text-center py-8 text-zinc-500">No revenue data available</div>
        ) : (
          <div className="space-y-3">
            {byPlan.map((item) => (
              <div key={item.planName} className="flex items-center justify-between p-3 bg-zinc-900/50 rounded-lg">
                <div>
                  <div className="font-medium text-white">{item.planName}</div>
                  <div className="text-xs text-zinc-500">{item.transactionCount} transactions</div>
                </div>
                <div className="text-lg font-bold text-emerald-400">
                  {formatCurrency(item.totalRevenue)}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Revenue by Payment Method */}
      <Card>
        <h3 className="text-lg font-bold text-white mb-4">Revenue by Payment Method</h3>
        {isLoading ? (
          <div className="text-center py-8 text-zinc-500">
            <i className="fas fa-circle-notch fa-spin mr-2"></i> Loading...
          </div>
        ) : byPaymentMethod.length === 0 ? (
          <div className="text-center py-8 text-zinc-500">No payment method data available</div>
        ) : (
          <div className="space-y-3">
            {byPaymentMethod.map((item) => (
              <div key={item.paymentMethod} className="flex items-center justify-between p-3 bg-zinc-900/50 rounded-lg">
                <div>
                  <div className="font-medium text-white capitalize">
                    {item.paymentMethod.replace(/_/g, ' ')}
                  </div>
                  <div className="text-xs text-zinc-500">{item.transactionCount} transactions</div>
                </div>
                <div className="text-lg font-bold text-cyan-400">
                  {formatCurrency(item.totalRevenue)}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};


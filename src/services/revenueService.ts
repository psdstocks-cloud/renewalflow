import { apiFetch } from './apiClient';
import { RevenueMetrics, RevenueByPlan, RevenueByPaymentMethod } from '@/src/types';

export async function fetchRevenueMetrics(
  startDate?: string,
  endDate?: string
): Promise<RevenueMetrics> {
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  
  return apiFetch<RevenueMetrics>(`/api/revenue/metrics?${params.toString()}`);
}

export async function fetchRevenueRecovery(
  startDate?: string,
  endDate?: string
): Promise<{ recovered: number }> {
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  
  return apiFetch<{ recovered: number }>(`/api/revenue/recovery?${params.toString()}`);
}

export async function fetchMRR(): Promise<{ mrr: number; arr: number }> {
  return apiFetch<{ mrr: number; arr: number }>('/api/revenue/mrr');
}

export async function fetchChurnRevenue(
  startDate?: string,
  endDate?: string
): Promise<{ lost: number }> {
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  
  return apiFetch<{ lost: number }>(`/api/revenue/churn?${params.toString()}`);
}

export async function fetchRevenueByPlan(
  startDate?: string,
  endDate?: string
): Promise<RevenueByPlan[]> {
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  
  return apiFetch<RevenueByPlan[]>(`/api/revenue/by-plan?${params.toString()}`);
}

export async function fetchRevenueByPaymentMethod(
  startDate?: string,
  endDate?: string
): Promise<RevenueByPaymentMethod[]> {
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  
  return apiFetch<RevenueByPaymentMethod[]>(`/api/revenue/by-payment-method?${params.toString()}`);
}

export async function fetchRevenueForecast(
  daysAhead: number = 30,
  renewalRate: number = 0.7
): Promise<{ potentialRevenue: number; expiringCount: number; renewalRate: number; daysAhead: number }> {
  return apiFetch(`/api/revenue/forecast?days=${daysAhead}&renewalRate=${renewalRate}`);
}


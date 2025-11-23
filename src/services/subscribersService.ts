import { apiFetch } from './apiClient';
import { SubscribersResponse } from '../types';

export type SubscribersQueryParams = {
  q?: string;
  status?: string;
  source?: string;
  tag?: string;
  nextRenewalFrom?: string;
  nextRenewalTo?: string;
  expiringInDays?: number;
  hasPhone?: boolean;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
};

export async function fetchSubscribers(params: SubscribersQueryParams = {}): Promise<SubscribersResponse> {
  const query = new URLSearchParams();

  if (params.q) query.set('q', params.q);
  if (params.status) query.set('status', params.status);
  if (params.source) query.set('source', params.source);
  if (params.tag) query.set('tag', params.tag);
  if (params.nextRenewalFrom) query.set('nextRenewalFrom', params.nextRenewalFrom);
  if (params.nextRenewalTo) query.set('nextRenewalTo', params.nextRenewalTo);
  if (params.expiringInDays !== undefined) query.set('expiringInDays', String(params.expiringInDays));
  if (typeof params.hasPhone === 'boolean') query.set('hasPhone', String(params.hasPhone));
  query.set('page', String(params.page ?? 1));
  query.set('pageSize', String(params.pageSize ?? 25));
  if (params.sortBy) query.set('sortBy', params.sortBy);
  if (params.sortDir) query.set('sortDir', params.sortDir);

  return apiFetch(`/api/subscribers?${query.toString()}`);
}

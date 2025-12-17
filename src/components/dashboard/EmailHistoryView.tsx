import React, { useState, useEffect } from 'react';
import { Card } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { apiFetch } from '@/src/services/apiClient';

interface EmailTrackingStatus {
    opened: boolean;
    openedAt: string | null;
    clicked: boolean;
    clickedAt: string | null;
    converted: boolean;
    convertedAt: string | null;
}

interface EmailItem {
    id: string;
    type: string;
    subject: string;
    bodyPreview: string;
    method: string;
    success: boolean;
    error: string | null;
    sentAt: string;
    tracking: EmailTrackingStatus;
    subscriber: {
        id: string;
        name: string;
        email: string;
    } | null;
}

interface EmailStats {
    totalSent: number;
    successful: number;
    failed: number;
    opened: number;
    clicked: number;
    converted: number;
    rates: {
        delivery: number;
        open: number;
        click: number;
        conversion: number;
    };
}

interface EmailsResponse {
    emails: EmailItem[];
    pagination: {
        page: number;
        limit: number;
        totalCount: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
    };
}

export const EmailHistoryView: React.FC = () => {
    const [emails, setEmails] = useState<EmailItem[]>([]);
    const [stats, setStats] = useState<EmailStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [selectedEmail, setSelectedEmail] = useState<EmailItem | null>(null);
    const [emailBody, setEmailBody] = useState<string | null>(null);

    useEffect(() => {
        loadEmails();
        loadStats();
    }, [page]);

    const loadEmails = async () => {
        try {
            setIsLoading(true);
            const response = await apiFetch<EmailsResponse>(`/api/emails?page=${page}&limit=10`);
            setEmails(response.emails);
            setTotalPages(response.pagination.totalPages);
        } catch (error) {
            console.error('Failed to load emails:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const loadStats = async () => {
        try {
            const response = await apiFetch<EmailStats>('/api/emails/stats');
            setStats(response);
        } catch (error) {
            console.error('Failed to load email stats:', error);
        }
    };

    const loadEmailDetails = async (emailId: string) => {
        try {
            const response = await apiFetch<{ id: string; body: string }>(`/api/emails/${emailId}`);
            setEmailBody(response.body);
        } catch (error) {
            console.error('Failed to load email details:', error);
        }
    };

    const handleViewEmail = (email: EmailItem) => {
        setSelectedEmail(email);
        loadEmailDetails(email.id);
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getStatusBadge = (email: EmailItem) => {
        if (!email.success) {
            return <span className="px-2 py-1 text-xs rounded-full bg-red-500/20 text-red-400">Failed</span>;
        }
        if (email.tracking.converted) {
            return <span className="px-2 py-1 text-xs rounded-full bg-green-500/20 text-green-400">Converted</span>;
        }
        if (email.tracking.clicked) {
            return <span className="px-2 py-1 text-xs rounded-full bg-cyan-500/20 text-cyan-400">Clicked</span>;
        }
        if (email.tracking.opened) {
            return <span className="px-2 py-1 text-xs rounded-full bg-violet-500/20 text-violet-400">Opened</span>;
        }
        return <span className="px-2 py-1 text-xs rounded-full bg-zinc-600/50 text-zinc-400">Sent</span>;
    };

    const getTypeBadge = (type: string) => {
        const colors: Record<string, string> = {
            'FIRST_REMINDER': 'bg-amber-500/20 text-amber-400',
            'FINAL_REMINDER': 'bg-orange-500/20 text-orange-400',
            'EXPIRED': 'bg-red-500/20 text-red-400',
        };
        return (
            <span className={`px-2 py-1 text-xs rounded-full ${colors[type] || 'bg-zinc-600/50 text-zinc-400'}`}>
                {type.replace(/_/g, ' ')}
            </span>
        );
    };

    return (
        <div className="space-y-6">
            {/* Stats Cards */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card className="p-4 text-center">
                        <div className="text-3xl font-bold text-white">{stats.totalSent}</div>
                        <div className="text-sm text-zinc-400">Total Sent</div>
                    </Card>
                    <Card className="p-4 text-center">
                        <div className="text-3xl font-bold text-violet-400">{stats.rates.open.toFixed(1)}%</div>
                        <div className="text-sm text-zinc-400">Open Rate</div>
                        <div className="text-xs text-zinc-500">{stats.opened} opened</div>
                    </Card>
                    <Card className="p-4 text-center">
                        <div className="text-3xl font-bold text-cyan-400">{stats.rates.click.toFixed(1)}%</div>
                        <div className="text-sm text-zinc-400">Click Rate</div>
                        <div className="text-xs text-zinc-500">{stats.clicked} clicked</div>
                    </Card>
                    <Card className="p-4 text-center">
                        <div className="text-3xl font-bold text-emerald-400">{stats.rates.conversion.toFixed(1)}%</div>
                        <div className="text-sm text-zinc-400">Conversion</div>
                        <div className="text-xs text-zinc-500">{stats.converted} converted</div>
                    </Card>
                </div>
            )}

            {/* Email List */}
            <Card className="overflow-hidden">
                <div className="p-4 border-b border-zinc-700/50 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white">
                        <i className="fas fa-envelope mr-2 text-violet-400"></i>
                        Email History
                    </h3>
                    <Button variant="ghost" size="sm" onClick={loadEmails}>
                        <i className="fas fa-sync-alt mr-2"></i>
                        Refresh
                    </Button>
                </div>

                {isLoading ? (
                    <div className="p-12 text-center text-zinc-400">
                        <i className="fas fa-spinner fa-spin text-2xl mb-2"></i>
                        <div>Loading emails...</div>
                    </div>
                ) : emails.length === 0 ? (
                    <div className="p-12 text-center text-zinc-400">
                        <i className="fas fa-inbox text-4xl mb-4 opacity-50"></i>
                        <div>No emails sent yet</div>
                        <div className="text-sm mt-2">Send reminders from the Action Center to see them here</div>
                    </div>
                ) : (
                    <div className="divide-y divide-zinc-700/50">
                        {emails.map((email) => (
                            <div
                                key={email.id}
                                className="p-4 hover:bg-zinc-800/50 cursor-pointer transition-colors"
                                onClick={() => handleViewEmail(email)}
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        {getTypeBadge(email.type)}
                                        {getStatusBadge(email)}
                                    </div>
                                    <span className="text-xs text-zinc-500">{formatDate(email.sentAt)}</span>
                                </div>
                                <div className="text-white font-medium mb-1">{email.subject}</div>
                                <div className="text-sm text-zinc-400 truncate">
                                    To: {email.subscriber?.name || 'Unknown'} ({email.subscriber?.email || 'No email'})
                                </div>

                                {/* Tracking Timeline */}
                                <div className="flex items-center gap-4 mt-3 text-xs">
                                    <div className={`flex items-center gap-1 ${email.success ? 'text-emerald-400' : 'text-red-400'}`}>
                                        <i className={`fas ${email.success ? 'fa-check-circle' : 'fa-times-circle'}`}></i>
                                        <span>{email.success ? 'Delivered' : 'Failed'}</span>
                                    </div>
                                    <div className={`flex items-center gap-1 ${email.tracking.opened ? 'text-violet-400' : 'text-zinc-600'}`}>
                                        <i className="fas fa-eye"></i>
                                        <span>{email.tracking.opened ? formatDate(email.tracking.openedAt!) : 'Not opened'}</span>
                                    </div>
                                    <div className={`flex items-center gap-1 ${email.tracking.clicked ? 'text-cyan-400' : 'text-zinc-600'}`}>
                                        <i className="fas fa-mouse-pointer"></i>
                                        <span>{email.tracking.clicked ? formatDate(email.tracking.clickedAt!) : 'No clicks'}</span>
                                    </div>
                                    {email.tracking.converted && (
                                        <div className="flex items-center gap-1 text-emerald-400">
                                            <i className="fas fa-dollar-sign"></i>
                                            <span>Converted!</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="p-4 border-t border-zinc-700/50 flex items-center justify-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                        >
                            <i className="fas fa-chevron-left"></i>
                        </Button>
                        <span className="text-sm text-zinc-400">
                            Page {page} of {totalPages}
                        </span>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                        >
                            <i className="fas fa-chevron-right"></i>
                        </Button>
                    </div>
                )}
            </Card>

            {/* Email Detail Modal */}
            {selectedEmail && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <Card className="w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
                        <div className="p-4 border-b border-zinc-700/50 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-semibold text-white">{selectedEmail.subject}</h3>
                                <div className="text-sm text-zinc-400">
                                    To: {selectedEmail.subscriber?.name} ({selectedEmail.subscriber?.email})
                                </div>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => { setSelectedEmail(null); setEmailBody(null); }}>
                                <i className="fas fa-times"></i>
                            </Button>
                        </div>
                        <div className="p-4 overflow-y-auto flex-1">
                            {emailBody ? (
                                <div
                                    className="prose prose-invert max-w-none"
                                    dangerouslySetInnerHTML={{ __html: emailBody }}
                                />
                            ) : (
                                <div className="text-center text-zinc-400">
                                    <i className="fas fa-spinner fa-spin"></i> Loading...
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t border-zinc-700/50 flex items-center justify-between text-sm">
                            <div className="flex items-center gap-4">
                                {getTypeBadge(selectedEmail.type)}
                                {getStatusBadge(selectedEmail)}
                            </div>
                            <span className="text-zinc-500">{formatDate(selectedEmail.sentAt)}</span>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
};

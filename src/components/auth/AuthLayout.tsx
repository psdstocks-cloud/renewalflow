import React from 'react';
import { Link } from 'react-router-dom';

interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footerText?: string;
  footerLinkText?: string;
  footerLinkTo?: string;
}

export function AuthLayout({
  title,
  subtitle,
  children,
  footerText,
  footerLinkText,
  footerLinkTo,
}: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <div className="hidden lg:flex flex-1 items-center justify-center bg-gradient-to-br from-indigo-500 via-purple-500 to-slate-900">
        <div className="max-w-md p-10 text-left space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-black/30 px-4 py-2 text-sm">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span>Smart subscription reminders</span>
          </div>
          <h1 className="text-4xl font-bold leading-tight">
            RenewalFlow keeps your
            <span className="block text-emerald-300">subscriptions under control.</span>
          </h1>
          <p className="text-slate-100/80 text-sm">
            Connect your WooCommerce store, auto-sync customers, and let RenewalFlow email them
            before they churn. You just sip your coffee.
          </p>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-2xl p-8 shadow-xl space-y-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-500 flex items-center justify-center text-white font-semibold">
              RF
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">
                RenewalFlow
              </div>
              <div className="text-slate-200 text-sm">
                Subscription Reminder Dashboard
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-semibold text-slate-50">{title}</h2>
            {subtitle && (
              <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
            )}
          </div>

          <div>{children}</div>

          {footerText && footerLinkText && footerLinkTo && (
            <div className="pt-2 text-center text-sm text-slate-400">
              {footerText}{' '}
              <Link to={footerLinkTo} className="text-indigo-400 hover:text-indigo-300 font-medium">
                {footerLinkText}
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

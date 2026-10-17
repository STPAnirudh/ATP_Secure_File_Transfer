import React, { useEffect, useState } from 'react';
import {
  ListTree,
  ShieldCheck,
  AlertTriangle,
  Info,
  XCircle,
  RefreshCw,
  Terminal,
  Trash2,
  AlertCircle,
} from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { ConfirmModal } from '../components/ConfirmModal';
import { api } from '../services/api';
import { ActivityLog } from '../types';
import { formatDateTime } from '../utils/date';

export const ActivityPage: React.FC = () => {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const loadActivity = async () => {
    try {
      const data = await api.getActivity(100);
      setActivities(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActivity();
    const interval = setInterval(loadActivity, 4000);
    return () => clearInterval(interval);
  }, []);

  const promptClearLogs = () => {
    if (activities.length === 0) return;
    setConfirmState({
      isOpen: true,
      title: 'Clear Activity Logs',
      message: 'Are you sure you want to clear all network activity audit logs? This cannot be undone.',
      onConfirm: async () => {
        try {
          await api.clearActivity();
          setActivities([]);
          setActionMessage('All activity logs cleared');
          setTimeout(() => setActionMessage(null), 3000);
        } catch (err: any) {
          setActionMessage(`Clear failed: ${err.message}`);
          setTimeout(() => setActionMessage(null), 3000);
        } finally {
          setConfirmState((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const filtered = activities.filter((act) => {
    if (filter === 'all') return true;
    return act.severity === filter;
  });

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'success':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <ShieldCheck className="w-3 h-3" />
            SUCCESS
          </span>
        );
      case 'warning':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <AlertTriangle className="w-3 h-3" />
            WARNING
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <XCircle className="w-3 h-3" />
            ERROR
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Info className="w-3 h-3" />
            INFO
          </span>
        );
    }
  };

  return (
    <AppShell>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <span className="agnos-badge mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-agnos-vermilion"></span>
            IMMUTABLE EVENT AUDIT
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Network Activity & Audit Trail
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Persisted operational log of socket events, cryptographic handshakes, and checkpoint saves.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {activities.length > 0 && (
            <button
              onClick={promptClearLogs}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-rose-500/10 hover:bg-rose-500/20 text-xs font-medium text-rose-400 border border-rose-500/20 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear Logs
            </button>
          )}

          <button
            onClick={() => {
              setLoading(true);
              loadActivity();
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-xs font-medium text-zinc-300 border border-white/[0.08] transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Audit
          </button>
        </div>
      </div>

      {actionMessage && (
        <div className="mb-6 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto no-scrollbar">
        {[
          { id: 'all', label: 'All Events' },
          { id: 'info', label: 'Info' },
          { id: 'success', label: 'Success & Verified' },
          { id: 'warning', label: 'Warnings' },
          { id: 'error', label: 'Errors & Violations' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
              filter === tab.id
                ? 'bg-white/[0.12] text-white border border-white/[0.15]'
                : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="agnos-card p-12 text-center">
          <Terminal className="w-8 h-8 text-zinc-500 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-white mb-1">No Activity Logged</h3>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto">
            Operational events will be recorded automatically as transfers occur.
          </p>
        </div>
      ) : (
        <div className="agnos-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-white/[0.03] border-b border-white/[0.06] text-zinc-400">
                <tr>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Severity</th>
                  <th className="py-3 px-4">Event Type</th>
                  <th className="py-3 px-4">Transfer Ref</th>
                  <th className="py-3 px-4">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {filtered.map((act) => (
                  <tr key={act.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-4 text-zinc-400 whitespace-nowrap">
                      {formatDateTime(act.timestamp)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {getSeverityBadge(act.severity)}
                    </td>
                    <td className="py-3 px-4 font-semibold text-white whitespace-nowrap">
                      {act.event_type}
                    </td>
                    <td className="py-3 px-4 text-zinc-400 whitespace-nowrap">
                      {act.transfer_id ? `${act.transfer_id.slice(0, 8)}...` : '—'}
                    </td>
                    <td className="py-3 px-4 text-zinc-300 font-sans">
                      {act.details}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Floating Confirm Modal for Clearing Activity Logs */}
      <ConfirmModal
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        confirmLabel="Clear Logs"
        cancelLabel="Cancel"
        isDestructive={true}
        onConfirm={confirmState.onConfirm}
        onCancel={() => setConfirmState((prev) => ({ ...prev, isOpen: false }))}
      />
    </AppShell>
  );
};

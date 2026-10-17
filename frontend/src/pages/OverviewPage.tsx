import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Server,
  ArrowUpRight,
  CheckCircle2,
  AlertTriangle,
  HardDrive,
  RefreshCw,
  UploadCloud,
  FileCheck2,
  Shield,
  Activity,
  ArrowRight,
} from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { TransferCard } from '../components/TransferCard';
import { StatusBadge } from '../components/StatusBadge';
import { NetworkQrCard } from '../components/NetworkQrCard';
import { api } from '../services/api';
import { ServerHealth, Transfer, ActivityLog } from '../types';

export const OverviewPage: React.FC = () => {
  const [health, setHealth] = useState<ServerHealth | null>(null);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const [h, t, a] = await Promise.all([
        api.getHealth().catch(() => null),
        api.getTransfers().catch(() => []),
        api.getActivity(6).catch(() => []),
      ]);
      setHealth(h);
      setTransfers(t);
      setActivities(a);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleResume = async (id: string) => {
    try {
      await api.resumeTransfer(id);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRetry = async (id: string) => {
    try {
      await api.retryTransfer(id);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const activeTransfers = transfers.filter((t) => t.status === 'in_progress');
  const interruptedTransfers = transfers.filter((t) => t.status === 'interrupted');
  const completedTransfers = transfers.filter((t) => t.status === 'completed');

  return (
    <AppShell>
      {/* Top Banner / Heading */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <span className="agnos-badge mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-agnos-vermilion"></span>
            LOCAL TRANSFER NODE
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Network Overview & Node Status
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Real-time TCP socket engine status, authenticated session contexts, and active chunk streams.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setLoading(true);
              loadData();
            }}
            className="p-2 rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-zinc-400 hover:text-white border border-white/[0.08] transition-colors"
            title="Refresh Status"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Link
            to="/app/send"
            className="inline-flex items-center gap-2 px-5 py-2 rounded-full text-xs font-semibold bg-agnos-vermilion text-white hover:bg-agnos-vermilion-hover shadow-lg shadow-agnos-vermilion/20 transition-all hover:scale-[1.02]"
          >
            <UploadCloud className="w-4 h-4" />
            Send New File
          </Link>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="agnos-card p-5">
          <div className="flex items-center justify-between text-zinc-400 text-xs mb-3">
            <span>TCP Socket Node</span>
            <Server className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white mb-1">
            {health ? 'Port :9000 Online' : 'Connecting...'}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-mono">
            <span className={`w-2 h-2 rounded-full ${health ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
            <span>
              {health
                ? `${health.active_devices_count || 1} ${(health.active_devices_count || 1) === 1 ? 'device' : 'devices'} online • ${health.tcp_active_connections} active stream${health.tcp_active_connections === 1 ? '' : 's'}`
                : 'offline'}
            </span>
          </div>
        </div>

        <div className="agnos-card p-5">
          <div className="flex items-center justify-between text-zinc-400 text-xs mb-3">
            <span>Active Transfers</span>
            <ArrowUpRight className="w-4 h-4 text-agnos-vermilion" />
          </div>
          <div className="text-2xl font-bold text-white mb-1">
            {activeTransfers.length}
          </div>
          <div className="text-xs text-zinc-400 font-mono">
            {interruptedTransfers.length} interrupted (resumable)
          </div>
        </div>

        <div className="agnos-card p-5">
          <div className="flex items-center justify-between text-zinc-400 text-xs mb-3">
            <span>Verified Transfers</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white mb-1">
            {completedTransfers.length}
          </div>
          <div className="text-xs text-zinc-400 font-mono">
            100% SHA-256 match
          </div>
        </div>

        <div className="agnos-card p-5">
          <div className="flex items-center justify-between text-zinc-400 text-xs mb-3">
            <span>Total Transferred</span>
            <HardDrive className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold text-white mb-1">
            {formatBytes(health?.total_bytes_transferred || 0)}
          </div>
          <div className="text-xs text-zinc-400 font-mono">
            AES-256-GCM cipher stream
          </div>
        </div>
      </div>

      {/* Main Content Split: Transfers & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Active & Recent Transfers (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-white tracking-tight">Active & Interrupted Transfers</h2>
              <p className="text-xs text-zinc-400">Streams currently in flight or awaiting resumption</p>
            </div>
            <Link to="/app/transfers" className="text-xs text-agnos-vermilion hover:underline flex items-center gap-1">
              View all ({transfers.length})
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {activeTransfers.length === 0 && interruptedTransfers.length === 0 ? (
            <div className="agnos-card p-10 text-center">
              <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mx-auto text-zinc-400 mb-3">
                <UploadCloud className="w-6 h-6 text-zinc-400" />
              </div>
              <h3 className="text-sm font-semibold text-white mb-1">No Active Transfer Streams</h3>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto mb-5 leading-relaxed">
                All transfers have completed or the engine is idling. Select a file to test chunked AES-GCM transmission.
              </p>
              <Link
                to="/app/send"
                className="inline-flex items-center gap-2 px-5 py-2 rounded-full text-xs font-semibold bg-agnos-vermilion text-white hover:bg-agnos-vermilion-hover transition-colors"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                Initiate Transfer
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {[...activeTransfers, ...interruptedTransfers].map((t) => (
                <TransferCard
                  key={t.id}
                  transfer={t}
                  onResume={handleResume}
                  onRetry={handleRetry}
                />
              ))}
            </div>
          )}

          {/* Recent Completed Transfers */}
          {completedTransfers.length > 0 && (
            <div className="mt-8 space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Recently Completed Files
              </h3>
              <div className="space-y-3">
                {completedTransfers.slice(0, 3).map((t) => (
                  <TransferCard
                    key={t.id}
                    transfer={t}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Mobile Connect QR & Activity Feed (1 Col) */}
        <div className="space-y-6">
          {/* Network Access QR Code & Address Card */}
          <NetworkQrCard />

          <div>
            <h2 className="text-base font-semibold text-white tracking-tight">Recent Audit Activity</h2>
            <p className="text-xs text-zinc-400">Cryptographic handshakes and transfer events</p>
          </div>

          <div className="agnos-card p-5 space-y-4">
            {activities.length === 0 ? (
              <div className="text-center py-6 text-xs text-zinc-500">
                No recorded audit events yet.
              </div>
            ) : (
              <div className="space-y-3">
                {activities.map((act) => (
                  <div key={act.id} className="pb-3 border-b border-white/[0.04] last:border-0 last:pb-0">
                    <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-1">
                      <span className="font-mono text-zinc-300 font-semibold uppercase">
                        {act.event_type}
                      </span>
                      <span className="text-[10px] text-zinc-500">
                        {new Date(act.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-300 leading-snug">
                      {act.details}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-2 border-t border-white/[0.04]">
              <Link
                to="/app/activity"
                className="text-xs text-zinc-400 hover:text-white flex items-center justify-between"
              >
                <span>View Full Audit Log</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Node Parameter Card */}
          <div className="agnos-card p-5 text-xs">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-4 h-4 text-agnos-vermilion" />
              <h3 className="font-semibold text-white">Engine Specifications</h3>
            </div>
            <div className="space-y-2 font-mono text-[11px] text-zinc-400">
              <div className="flex justify-between">
                <span>Protocol:</span>
                <span className="text-zinc-200">ATP v1.0 (ATP1)</span>
              </div>
              <div className="flex justify-between">
                <span>Chunk Size:</span>
                <span className="text-zinc-200">65,536 B (64 KB)</span>
              </div>
              <div className="flex justify-between">
                <span>AEAD Cipher:</span>
                <span className="text-emerald-400">AES-256-GCM</span>
              </div>
              <div className="flex justify-between">
                <span>Key Exchange:</span>
                <span className="text-cyan-400">X25519 ECDH</span>
              </div>
              <div className="flex justify-between">
                <span>Integrity:</span>
                <span className="text-zinc-200">SHA-256 Digest</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
};

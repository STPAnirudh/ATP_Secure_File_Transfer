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
  Smartphone,
  Monitor,
  Tablet,
  Edit3,
  Check,
  Wifi,
} from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { TransferCard } from '../components/TransferCard';
import { StatusBadge } from '../components/StatusBadge';
import { NetworkQrCard } from '../components/NetworkQrCard';
import { ConfirmModal } from '../components/ConfirmModal';
import { api } from '../services/api';
import { ServerHealth, Transfer, ActivityLog } from '../types';
import { useDevice } from '../context/DeviceContext';
import { formatDateTime, formatTime } from '../utils/date';

export const OverviewPage: React.FC = () => {
  const { deviceId, deviceName, renameDevice, connectedDevices } = useDevice();
  const [health, setHealth] = useState<ServerHealth | null>(null);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  const [editingName, setEditingName] = useState(false);
  const [customNameInput, setCustomNameInput] = useState(deviceName);
  const [savingName, setSavingName] = useState(false);
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

  const loadData = async () => {
    try {
      const [h, t, a] = await Promise.all([
        api.getHealth().catch(() => null),
        api.getTransfers('all', deviceId).catch(() => []),
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
  }, [deviceId]);

  const handleSaveRename = async () => {
    if (!customNameInput.trim()) return;
    setSavingName(true);
    try {
      await renameDevice(customNameInput.trim());
      setEditingName(false);
    } finally {
      setSavingName(false);
    }
  };

  const handleResume = async (id: string) => {
    try {
      await api.resumeTransfer(id);
      loadData();
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleRetry = async (id: string) => {
    try {
      await api.retryTransfer(id);
      loadData();
    } catch (err: any) {
      console.error(err);
    }
  };

  const promptDeleteTransfer = (id: string) => {
    const target = transfers.find((t) => t.id === id);
    setConfirmState({
      isOpen: true,
      title: 'Delete Transfer Record',
      message: `Delete transfer record for "${target?.file_name || id.slice(0, 8)}"? This removes its chunk checkpoints from history.`,
      onConfirm: async () => {
        try {
          await api.deleteTransfer(id);
          loadData();
        } catch (err: any) {
          console.error(err);
        } finally {
          setConfirmState((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const activeTransfers = transfers.filter((t) => t.status === 'in_progress');
  const completedTransfers = transfers.filter((t) => t.status === 'completed');
  const interruptedTransfers = transfers.filter((t) => t.status === 'interrupted');

  const totalDevicesOnline = Math.max(
    connectedDevices.length,
    health?.active_devices_count || 1
  );

  return (
    <AppShell>
      {/* Overview Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <span className="agnos-badge mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-agnos-vermilion"></span>
            LIVE NETWORK CONTROL PLANE
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            ATP Engine Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Real-time TCP socket engine status, authenticated session contexts, and active chunk streams.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          <button
            onClick={() => {
              setLoading(true);
              loadData();
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-xs font-medium text-zinc-300 border border-white/[0.08] transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <Link
            to="/app/send"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold bg-agnos-vermilion text-white hover:bg-agnos-vermilion-hover shadow-lg shadow-agnos-vermilion/20 transition-all hover:scale-[1.02]"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            Send File
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
                ? `${totalDevicesOnline} ${totalDevicesOnline === 1 ? 'device' : 'devices'} online • ${health.tcp_active_connections} active stream${health.tcp_active_connections === 1 ? '' : 's'}`
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
            AES-256-GCM encrypted
          </div>
        </div>
      </div>

      {/* Main Grid: Left Column transfers + Right Column QR & Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Active & Recent Transfers (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-white tracking-tight">Active & Interrupted Transfers</h2>
              <p className="text-xs text-zinc-400">Streams currently running or saved as checkpoint</p>
            </div>
            <Link
              to="/app/transfers"
              className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 transition-colors"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {activeTransfers.length === 0 && interruptedTransfers.length === 0 ? (
            <div className="agnos-card p-10 text-center">
              <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mx-auto text-zinc-500 mb-3">
                <UploadCloud className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-white mb-1">No Active Transfer Streams</h3>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto mb-4">
                Transfers initiated through the web console or TCP socket client will appear here with live chunk progress.
              </p>
              <Link
                to="/app/send"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold bg-white/[0.08] hover:bg-white/[0.15] text-white border border-white/[0.1] transition-all"
              >
                Start Encrypted Transfer
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
                  onDelete={promptDeleteTransfer}
                />
              ))}
            </div>
          )}

          {/* Recent Completed Transfers */}
          {completedTransfers.length > 0 && (
            <div className="pt-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-white tracking-tight">Recent Completed Transmissions</h2>
                <Link
                  to="/app/received"
                  className="text-xs text-zinc-400 hover:text-white flex items-center gap-1"
                >
                  <span>Open Vault</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="space-y-3">
                {completedTransfers.slice(0, 3).map((t) => (
                  <TransferCard
                    key={t.id}
                    transfer={t}
                    onDelete={promptDeleteTransfer}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Connected Devices, Mobile Connect QR & Activity Feed (1 Col) */}
        <div className="space-y-6">
          {/* Connected Devices & Name Card */}
          <div className="agnos-card p-5 text-xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Wifi className="w-4 h-4 text-agnos-vermilion" />
                <h3 className="font-semibold text-white">Your Device & Peers</h3>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {totalDevicesOnline} Online
              </span>
            </div>

            {/* Rename device box */}
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] mb-3">
              <div className="text-[10px] uppercase font-mono text-zinc-500 mb-1">
                Your Device Identity
              </div>
              {!editingName ? (
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white truncate max-w-[150px]">{deviceName}</span>
                  <button
                    onClick={() => {
                      setCustomNameInput(deviceName);
                      setEditingName(true);
                    }}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white/[0.04] hover:bg-white/[0.08] text-[11px] text-zinc-300 transition-colors"
                  >
                    <Edit3 className="w-3 h-3" />
                    Rename
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 mt-1">
                  <input
                    type="text"
                    value={customNameInput}
                    onChange={(e) => setCustomNameInput(e.target.value)}
                    className="flex-1 px-2 py-1 rounded bg-black/60 border border-agnos-vermilion text-xs text-white focus:outline-none"
                    autoFocus
                  />
                  <button
                    disabled={savingName}
                    onClick={handleSaveRename}
                    className="px-2 py-1 rounded bg-agnos-vermilion text-white text-xs font-semibold"
                  >
                    <Check className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => setEditingName(false)}
                    className="px-1.5 py-1 text-xs text-zinc-400 hover:text-white"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>

            {/* Other peers preview */}
            <div className="space-y-1.5 font-mono text-[11px]">
              {connectedDevices.slice(0, 3).map((d) => (
                <div
                  key={d.device_id}
                  className="flex items-center justify-between py-1 px-2 rounded bg-white/[0.02] text-zinc-400"
                >
                  <span className="truncate max-w-[120px] text-zinc-300">
                    {d.device_id === deviceId ? `${deviceName} (You)` : d.device_name}
                  </span>
                  <span className="text-[10px] text-zinc-500">{d.client_ip}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Network Access QR Code & Address Card */}
          <NetworkQrCard />

          {/* Activity Feed */}
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
                        {formatTime(act.timestamp)}
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
        </div>
      </div>

      {/* Floating Confirm Modal for Deleting Transfers */}
      <ConfirmModal
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        isDestructive={true}
        onConfirm={confirmState.onConfirm}
        onCancel={() => setConfirmState((prev) => ({ ...prev, isOpen: false }))}
      />
    </AppShell>
  );
};

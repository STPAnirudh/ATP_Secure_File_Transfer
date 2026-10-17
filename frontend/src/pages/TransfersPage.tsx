import React, { useEffect, useState } from 'react';
import {
  Search,
  Filter,
  RefreshCw,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  X,
  Layers,
  ShieldCheck,
  Trash2,
  Radio,
  Smartphone,
  AlertCircle,
} from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { TransferCard } from '../components/TransferCard';
import { StatusBadge } from '../components/StatusBadge';
import { api } from '../services/api';
import { Transfer, TransferDetail } from '../types';
import { useDevice } from '../context/DeviceContext';
import { formatDateTime } from '../utils/date';

export const TransfersPage: React.FC = () => {
  const { deviceId } = useDevice();
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedTransfer, setSelectedTransfer] = useState<TransferDetail | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const loadTransfers = async () => {
    try {
      const data = await api.getTransfers(statusFilter, deviceId);
      setTransfers(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadTransfers();
    const interval = setInterval(loadTransfers, 3000);
    return () => clearInterval(interval);
  }, [statusFilter, deviceId]);

  const handleSelectTransfer = async (transfer: Transfer) => {
    setLoadingDetails(true);
    try {
      const detail = await api.getTransfer(transfer.id);
      setSelectedTransfer(detail);
    } catch {
      setSelectedTransfer({ ...transfer, chunks: [] });
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleResume = async (id: string) => {
    try {
      await api.resumeTransfer(id);
      loadTransfers();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRetry = async (id: string) => {
    try {
      await api.retryTransfer(id);
      loadTransfers();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteTransfer = async (id: string) => {
    if (!window.confirm('Delete this transfer log from history?')) return;
    try {
      await api.deleteTransfer(id);
      setTransfers((prev) => prev.filter((t) => t.id !== id));
      if (selectedTransfer?.id === id) setSelectedTransfer(null);
      setActionMessage('Transfer record deleted');
      setTimeout(() => setActionMessage(null), 3000);
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const handleClearAll = async () => {
    if (transfers.length === 0) return;
    if (!window.confirm('Clear all transfer records from history?')) return;
    try {
      await api.clearAllTransfers();
      setTransfers([]);
      setSelectedTransfer(null);
      setActionMessage('All transfer records cleared');
      setTimeout(() => setActionMessage(null), 3000);
    } catch (err: any) {
      alert(`Failed to clear: ${err.message}`);
    }
  };

  const filteredTransfers = transfers.filter((t) => {
    const matchesSearch =
      t.file_name.toLowerCase().includes(search.toLowerCase()) ||
      t.id.toLowerCase().includes(search.toLowerCase()) ||
      t.sha256_hash?.toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === 'all' || t.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <AppShell>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <span className="agnos-badge mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-agnos-vermilion"></span>
            PERSISTENT METADATA LEDGER
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Transfer History & Recovery
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Search, filter, and inspect verified chunk streams or resume interrupted transfers.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {transfers.length > 0 && (
            <button
              onClick={handleClearAll}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-rose-500/10 hover:bg-rose-500/20 text-xs font-medium text-rose-400 border border-rose-500/20 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear History
            </button>
          )}

          <button
            onClick={() => {
              setRefreshing(true);
              loadTransfers().finally(() => setRefreshing(false));
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-xs font-medium text-zinc-300 border border-white/[0.08] transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh Streams
          </button>
        </div>
      </div>

      {actionMessage && (
        <div className="mb-6 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by filename, ID or SHA-256..."
            className="w-full pl-10 pr-4 py-2 rounded-full bg-white/[0.03] border border-white/[0.08] text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-agnos-vermilion focus:ring-1 focus:ring-agnos-vermilion transition-all"
          />
        </div>

        {/* Status Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
          {[
            { id: 'all', label: 'All Transfers' },
            { id: 'in_progress', label: 'In Progress' },
            { id: 'completed', label: 'Completed' },
            { id: 'interrupted', label: 'Interrupted' },
            { id: 'failed', label: 'Failed' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                statusFilter === tab.id
                  ? 'bg-white/[0.12] text-white border border-white/[0.15]'
                  : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Transfers Grid */}
      {filteredTransfers.length === 0 ? (
        <div className="agnos-card p-12 text-center">
          <Layers className="w-10 h-10 text-zinc-500 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-white mb-1">No Transfers Match Your Filter</h3>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto">
            Try adjusting your search query, status filters, or start a new encrypted transfer.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTransfers.map((transfer) => (
            <TransferCard
              key={transfer.id}
              transfer={transfer}
              onResume={handleResume}
              onRetry={handleRetry}
              onSelect={handleSelectTransfer}
              onDelete={handleDeleteTransfer}
            />
          ))}
        </div>
      )}

      {/* Transfer Detail Inspection Modal */}
      {selectedTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl agnos-card p-6 sm:p-8 max-h-[90vh] overflow-y-auto shadow-2xl border border-white/[0.1]">
            <button
              onClick={() => setSelectedTransfer(null)}
              className="absolute top-5 right-5 p-1 rounded-full text-zinc-400 hover:text-white hover:bg-white/[0.1] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-2">
              <span className="agnos-badge">TRANSFER INSPECTION</span>
              <StatusBadge status={selectedTransfer.status} />
            </div>

            <h2 className="text-xl font-bold text-white mb-1 break-all">
              {selectedTransfer.file_name}
            </h2>
            <div className="text-xs font-mono text-zinc-400 mb-6">
              ID: {selectedTransfer.id}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] mb-6 font-mono text-xs">
              <div>
                <span className="text-zinc-500 text-[11px] block">Total Size</span>
                <span className="text-zinc-200 font-semibold">{formatBytes(selectedTransfer.file_size)}</span>
              </div>
              <div>
                <span className="text-zinc-500 text-[11px] block">Transferred</span>
                <span className="text-zinc-200 font-semibold">{formatBytes(selectedTransfer.transferred_bytes)}</span>
              </div>
              <div>
                <span className="text-zinc-500 text-[11px] block">Chunks</span>
                <span className="text-zinc-200 font-semibold">{selectedTransfer.completed_chunks} / {selectedTransfer.total_chunks}</span>
              </div>
              <div>
                <span className="text-zinc-500 text-[11px] block">Direction</span>
                <span className="text-zinc-200 uppercase">{selectedTransfer.direction}</span>
              </div>
              <div>
                <span className="text-zinc-500 text-[11px] block">Date & Time</span>
                <span className="text-zinc-200">{formatDateTime(selectedTransfer.created_at)}</span>
              </div>
              <div>
                <span className="text-zinc-500 text-[11px] block">Target</span>
                <span className="text-zinc-200">{selectedTransfer.target_device_id || 'broadcast'}</span>
              </div>
            </div>

            {/* SHA-256 Digest */}
            <div className="mb-6">
              <div className="text-xs font-semibold text-zinc-300 mb-1 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>End-to-End SHA-256 Checksum</span>
              </div>
              <div className="p-3 rounded-lg bg-black/50 border border-white/[0.06] font-mono text-xs text-emerald-400 break-all select-all">
                {selectedTransfer.sha256_hash}
              </div>
            </div>

            {/* Chunks Checklist */}
            <div className="mb-6">
              <div className="flex items-center justify-between text-xs font-semibold text-zinc-300 mb-2">
                <span>Checkpoint Chunk Verification ({selectedTransfer.chunks?.length || 0} chunks logged)</span>
                <span className="font-mono text-zinc-500 text-[11px]">64 KB atomic segments</span>
              </div>

              <div className="max-h-48 overflow-y-auto space-y-1 rounded-xl bg-black/30 p-2 border border-white/[0.04]">
                {(!selectedTransfer.chunks || selectedTransfer.chunks.length === 0) ? (
                  <div className="text-center py-6 text-xs text-zinc-500">
                    No individual chunk records logged for this transfer.
                  </div>
                ) : (
                  selectedTransfer.chunks.map((c) => (
                    <div
                      key={c.chunk_index}
                      className="flex items-center justify-between py-1.5 px-3 rounded bg-white/[0.02] text-[11px] font-mono"
                    >
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-zinc-300">Chunk #{c.chunk_index}</span>
                        <span className="text-zinc-500">Offset: {c.byte_offset} B</span>
                      </div>
                      <span className="text-emerald-400 text-[10px]">VERIFIED (AEAD)</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-white/[0.08]">
              <button
                onClick={() => handleDeleteTransfer(selectedTransfer.id)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Record
              </button>

              <button
                onClick={() => setSelectedTransfer(null)}
                className="px-5 py-2 rounded-full text-xs font-medium bg-white/[0.08] hover:bg-white/[0.15] text-white transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
};

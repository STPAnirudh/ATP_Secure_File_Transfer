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
} from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { TransferCard } from '../components/TransferCard';
import { StatusBadge } from '../components/StatusBadge';
import { api } from '../services/api';
import { Transfer, TransferDetail, TransferStatus } from '../types';

export const TransfersPage: React.FC = () => {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedTransfer, setSelectedTransfer] = useState<TransferDetail | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadTransfers = async () => {
    try {
      const data = await api.getTransfers();
      setTransfers(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadTransfers();
    const interval = setInterval(loadTransfers, 3000);
    return () => clearInterval(interval);
  }, []);

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

        <button
          onClick={() => {
            setRefreshing(true);
            loadTransfers().finally(() => setRefreshing(false));
          }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-xs font-medium text-zinc-300 border border-white/[0.08] transition-colors self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh Streams
        </button>
      </div>

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

      {/* Transfers List */}
      {filteredTransfers.length === 0 ? (
        <div className="agnos-card p-12 text-center">
          <Layers className="w-8 h-8 text-zinc-500 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-white mb-1">No Transfers Match Your Filters</h3>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto">
            Try adjusting your search query or status filter to see recorded transfers.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTransfers.map((t) => (
            <TransferCard
              key={t.id}
              transfer={t}
              onResume={handleResume}
              onRetry={handleRetry}
              onSelect={handleSelectTransfer}
            />
          ))}
        </div>
      )}

      {/* Transfer Details Modal */}
      {selectedTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="agnos-card w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6 relative border border-white/[0.15]">
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
                <span className="text-zinc-500 text-[11px] block">Created</span>
                <span className="text-zinc-200">{new Date(selectedTransfer.created_at).toLocaleTimeString()}</span>
              </div>
              <div>
                <span className="text-zinc-500 text-[11px] block">Client Host</span>
                <span className="text-zinc-200">{selectedTransfer.client_ip || '127.0.0.1'}</span>
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
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-zinc-300 mb-2">
                <span>Checkpoint Chunk Verification ({selectedTransfer.chunks?.length || 0} chunks logged)</span>
                <span className="font-mono text-zinc-500 text-[11px]">64 KB atomic segments</span>
              </div>

              {selectedTransfer.chunks && selectedTransfer.chunks.length > 0 ? (
                <div className="max-h-52 overflow-y-auto space-y-1.5 font-mono text-xs pr-1">
                  {selectedTransfer.chunks.map((chk) => (
                    <div
                      key={chk.chunk_index}
                      className="flex items-center justify-between p-2 rounded bg-white/[0.02] border border-white/[0.04]"
                    >
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Chunk #{chk.chunk_index}</span>
                        <span className="text-zinc-500 text-[11px]">offset: {chk.byte_offset}</span>
                      </div>
                      <span className="text-zinc-400 text-[11px]">{formatBytes(chk.chunk_size)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 rounded bg-white/[0.02] text-center text-xs text-zinc-500">
                  {selectedTransfer.status === 'in_progress'
                    ? 'Recording chunks in flight...'
                    : 'All chunks committed to destination file.'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
};

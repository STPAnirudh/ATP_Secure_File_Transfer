import React from 'react';
import { Transfer } from '../types';
import { StatusBadge } from './StatusBadge';
import {
  ArrowUpRight,
  ArrowDownLeft,
  RotateCw,
  ExternalLink,
  Trash2,
  Radio,
  Smartphone,
} from 'lucide-react';

interface Props {
  transfer: Transfer;
  onResume?: (id: string) => void;
  onRetry?: (id: string) => void;
  onSelect?: (transfer: Transfer) => void;
  onDelete?: (id: string) => void;
}

export const TransferCard: React.FC<Props> = ({
  transfer,
  onResume,
  onRetry,
  onSelect,
  onDelete,
}) => {
  const percent = transfer.file_size > 0
    ? Math.min(100, Math.round((transfer.transferred_bytes / transfer.file_size) * 100))
    : 0;

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const isBroadcast = !transfer.target_device_id || transfer.target_device_id === 'broadcast';

  return (
    <div
      onClick={() => onSelect && onSelect(transfer)}
      className="agnos-card agnos-card-hover p-5 cursor-pointer transition-all"
    >
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-zinc-300 flex-shrink-0">
            {transfer.direction === 'upload' ? (
              <ArrowUpRight className="w-5 h-5 text-agnos-vermilion" />
            ) : (
              <ArrowDownLeft className="w-5 h-5 text-cyan-400" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm font-semibold text-white truncate max-w-xs sm:max-w-md">
                {transfer.file_name}
              </h4>
              {isBroadcast ? (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-mono bg-white/[0.05] text-zinc-400">
                  <Radio className="w-2.5 h-2.5 text-agnos-vermilion" />
                  Broadcast
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-mono bg-agnos-vermilion/15 text-agnos-vermilion">
                  <Smartphone className="w-2.5 h-2.5" />
                  Direct
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono mt-0.5">
              <span>{formatBytes(transfer.file_size)}</span>
              <span>•</span>
              <span>{transfer.total_chunks} chunks</span>
              <span>•</span>
              <span className="truncate max-w-[120px]">ID: {transfer.id.slice(0, 8)}...</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <StatusBadge status={transfer.status} />

          {transfer.status === 'interrupted' && onResume && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onResume(transfer.id);
              }}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/30 transition-colors"
            >
              <RotateCw className="w-3 h-3" />
              Resume
            </button>
          )}

          {transfer.status === 'failed' && onRetry && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRetry(transfer.id);
              }}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/30 transition-colors"
            >
              <RotateCw className="w-3 h-3" />
              Retry
            </button>
          )}

          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(transfer.id);
              }}
              className="p-1.5 rounded-full text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
              title="Delete transfer record"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-1.5 mt-4">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-zinc-400">
            {formatBytes(transfer.transferred_bytes)} / {formatBytes(transfer.file_size)}
          </span>
          <span className={transfer.status === 'completed' ? 'text-emerald-400 font-bold' : 'text-zinc-200'}>
            {percent}%
          </span>
        </div>
        <div className="w-full h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              transfer.status === 'completed'
                ? 'bg-emerald-400'
                : transfer.status === 'failed'
                ? 'bg-rose-500'
                : transfer.status === 'interrupted'
                ? 'bg-amber-400'
                : 'bg-agnos-vermilion'
            }`}
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {/* SHA256 preview */}
      <div className="mt-3 pt-3 border-t border-white/[0.04] flex items-center justify-between text-[11px] font-mono text-zinc-500">
        <span className="truncate max-w-xs">
          SHA-256: {transfer.sha256_hash ? `${transfer.sha256_hash.slice(0, 16)}...` : 'Computing...'}
        </span>
        <span className="text-zinc-400 text-xs hover:text-white flex items-center gap-1">
          Inspect Details
          <ExternalLink className="w-3 h-3" />
        </span>
      </div>
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import {
  FileCheck2,
  Download,
  ShieldCheck,
  RefreshCw,
  FolderOpen,
  Lock,
  Trash2,
  Radio,
  Smartphone,
  AlertCircle,
} from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { ConfirmModal } from '../components/ConfirmModal';
import { api } from '../services/api';
import { ReceivedFile } from '../types';
import { useDevice } from '../context/DeviceContext';
import { formatDateTime } from '../utils/date';

export const ReceivedPage: React.FC = () => {
  const { deviceId } = useDevice();
  const [files, setFiles] = useState<ReceivedFile[]>([]);
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

  const loadFiles = async () => {
    try {
      const data = await api.getReceivedFiles(deviceId);
      setFiles(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFiles();
  }, [deviceId]);

  const promptDeleteFile = (fileName: string) => {
    setConfirmState({
      isOpen: true,
      title: 'Delete Received File',
      message: `Are you sure you want to permanently delete "${fileName}" from the vault? This will also remove its corresponding records from transfer history.`,
      onConfirm: async () => {
        try {
          await api.deleteReceivedFile(fileName);
          setFiles((prev) => prev.filter((f) => f.name !== fileName));
          setActionMessage(`Deleted "${fileName}" and synced transfer history`);
          setTimeout(() => setActionMessage(null), 3000);
        } catch (err: any) {
          setActionMessage(`Failed to delete: ${err.message}`);
          setTimeout(() => setActionMessage(null), 3000);
        } finally {
          setConfirmState((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const promptClearAll = () => {
    if (files.length === 0) return;
    setConfirmState({
      isOpen: true,
      title: 'Clear Entire Vault',
      message: 'Are you sure you want to delete all received files from the vault and clear their transfer records? This cannot be undone.',
      onConfirm: async () => {
        try {
          await api.clearAllReceivedFiles();
          setFiles([]);
          setActionMessage('All vault files and transfer records cleared successfully');
          setTimeout(() => setActionMessage(null), 3000);
        } catch (err: any) {
          setActionMessage(`Failed to clear: ${err.message}`);
          setTimeout(() => setActionMessage(null), 3000);
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

  return (
    <AppShell>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <span className="agnos-badge mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-agnos-vermilion"></span>
            ISOLATED STORAGE VAULT
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Received & Verified Files
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Reconstructed files verified against authentic SHA-256 digests. Only files targeted to this device or broadcast to the network are displayed.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {files.length > 0 && (
            <button
              onClick={promptClearAll}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-rose-500/10 hover:bg-rose-500/20 text-xs font-medium text-rose-400 border border-rose-500/20 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear Vault
            </button>
          )}

          <button
            onClick={() => {
              setLoading(true);
              loadFiles();
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-xs font-medium text-zinc-300 border border-white/[0.08] transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Vault
          </button>
        </div>
      </div>

      {actionMessage && (
        <div className="mb-6 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* Files List */}
      {files.length === 0 ? (
        <div className="agnos-card p-12 text-center">
          <FolderOpen className="w-10 h-10 text-zinc-500 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-white mb-1">No Received Files Yet</h3>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto">
            Files received over the TCP network addressed to your device or broadcast on Wi-Fi will appear here after complete AES-GCM verification.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {files.map((file) => {
            const isBroadcast = !file.target_device_id || file.target_device_id === 'broadcast';
            return (
              <div
                key={file.name}
                className="agnos-card agnos-card-hover p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
                    <FileCheck2 className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-white truncate max-w-sm">
                        {file.name}
                      </h3>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <ShieldCheck className="w-3 h-3" />
                        SHA-256 Verified
                      </span>
                      {isBroadcast ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-white/[0.05] text-zinc-400 border border-white/[0.08]">
                          <Radio className="w-2.5 h-2.5 text-agnos-vermilion" />
                          Broadcast
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-agnos-vermilion/15 text-agnos-vermilion border border-agnos-vermilion/30">
                          <Smartphone className="w-2.5 h-2.5" />
                          Direct to You
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs font-mono text-zinc-400 mt-1 flex-wrap">
                      <span>{formatBytes(file.size)}</span>
                      <span>•</span>
                      <span>Received: {formatDateTime(file.received_at)}</span>
                      <span>•</span>
                      <span className="truncate max-w-[140px] text-zinc-500">
                        {file.sha256_hash.slice(0, 16)}...
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-auto">
                  <a
                    href={api.getFileDownloadUrl(file.name)}
                    download={file.name}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold bg-white/[0.08] hover:bg-white/[0.15] text-white border border-white/[0.1] transition-all hover:scale-[1.02]"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download File
                  </a>
                  <button
                    onClick={() => promptDeleteFile(file.name)}
                    className="p-2 rounded-full text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-colors cursor-pointer"
                    title="Delete this file"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Security Note on Path Traversal */}
      <div className="mt-8 p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] flex items-start gap-3 text-xs text-zinc-400">
        <Lock className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
        <div>
          <strong className="text-white block mb-0.5">Strict Path Traversal Protection Active:</strong>
          File requests are sanitised through absolute path canonicalization and restricted solely to the designated <code className="text-zinc-200">data/received/</code> vault directory. Directory traversal attempts (e.g. <code className="text-zinc-400">../</code>) are detected and blocked.
        </div>
      </div>

      {/* Floating Confirm Modal for Deleting Files */}
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

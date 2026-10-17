import React, { useEffect, useState } from 'react';
import {
  Sliders,
  Save,
  Server,
  HardDrive,
  Cpu,
  Shield,
  CheckCircle2,
  FolderOpen,
} from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { NetworkQrCard } from '../components/NetworkQrCard';
import { api } from '../services/api';

export const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<any>({
    tcp_port: 9000,
    http_port: 8000,
    chunk_size: 65536,
    max_clients: 16,
    socket_timeout: 30,
    cipher_suite: 'AES-256-GCM',
    key_exchange: 'X25519-HKDF-SHA256',
    uploads_dir: 'data/uploads',
    received_dir: 'data/received',
    db_path: 'data/atp_transfers.db',
  });
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getSettings()
      .then((data) => {
        if (data && Object.keys(data).length > 0) {
          setSettings(data);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.updateSettings(settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to update settings');
    }
  };

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <span className="agnos-badge mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-agnos-vermilion"></span>
            NODE CONFIGURATION
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            System & Transfer Settings
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Configure TCP socket parameters, buffer sizes, concurrency limits, and local vault directories.
          </p>
        </div>

        {/* Cross-Device Access QR Card */}
        <div className="mb-6">
          <NetworkQrCard />
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          {/* Section: Network & Sockets */}
          <div className="agnos-card p-6 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-white/[0.06]">
              <Server className="w-4 h-4 text-agnos-vermilion" />
              <h2 className="text-sm font-semibold text-white">Network & Socket Engine</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-zinc-400 mb-1 font-medium">TCP Transfer Port</label>
                <input
                  type="number"
                  value={settings.tcp_port}
                  onChange={(e) => setSettings({ ...settings, tcp_port: parseInt(e.target.value) })}
                  className="w-full px-3.5 py-2 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white focus:outline-none focus:border-agnos-vermilion font-mono"
                />
                <span className="text-[11px] text-zinc-500 mt-1 block">Dedicated port for framed byte streams</span>
              </div>

              <div>
                <label className="block text-zinc-400 mb-1 font-medium">HTTP Control API Port</label>
                <input
                  type="number"
                  value={settings.http_port}
                  onChange={(e) => setSettings({ ...settings, http_port: parseInt(e.target.value) })}
                  className="w-full px-3.5 py-2 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white focus:outline-none focus:border-agnos-vermilion font-mono"
                />
                <span className="text-[11px] text-zinc-500 mt-1 block">FastAPI control plane & telemetry</span>
              </div>

              <div>
                <label className="block text-zinc-400 mb-1 font-medium">Max Concurrent Clients</label>
                <input
                  type="number"
                  value={settings.max_clients}
                  onChange={(e) => setSettings({ ...settings, max_clients: parseInt(e.target.value) })}
                  className="w-full px-3.5 py-2 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white focus:outline-none focus:border-agnos-vermilion font-mono"
                />
                <span className="text-[11px] text-zinc-500 mt-1 block">Thread pool and socket connection limit</span>
              </div>

              <div>
                <label className="block text-zinc-400 mb-1 font-medium">Socket Read/Write Timeout (seconds)</label>
                <input
                  type="number"
                  value={settings.socket_timeout}
                  onChange={(e) => setSettings({ ...settings, socket_timeout: parseInt(e.target.value) })}
                  className="w-full px-3.5 py-2 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white focus:outline-none focus:border-agnos-vermilion font-mono"
                />
                <span className="text-[11px] text-zinc-500 mt-1 block">Drop stale or silent TCP connections</span>
              </div>
            </div>
          </div>

          {/* Section: Protocol & Buffering */}
          <div className="agnos-card p-6 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-white/[0.06]">
              <Cpu className="w-4 h-4 text-cyan-400" />
              <h2 className="text-sm font-semibold text-white">Framing & Chunk Buffers</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-zinc-400 mb-1 font-medium">Default Chunk Transmission Size</label>
                <select
                  value={settings.chunk_size}
                  onChange={(e) => setSettings({ ...settings, chunk_size: parseInt(e.target.value) })}
                  className="w-full px-3.5 py-2 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white focus:outline-none focus:border-agnos-vermilion font-mono"
                >
                  <option value={32768} className="bg-agnos-card">32 KB (Low-bandwidth networks)</option>
                  <option value={65536} className="bg-agnos-card">64 KB (Recommended default)</option>
                  <option value={131072} className="bg-agnos-card">128 KB (High-throughput LAN)</option>
                  <option value={262144} className="bg-agnos-card">256 KB (Maximum throughput)</option>
                </select>
                <span className="text-[11px] text-zinc-500 mt-1 block">Atomic AEAD encryption chunk boundary</span>
              </div>

              <div>
                <label className="block text-zinc-400 mb-1 font-medium">Checkpoint Persistence</label>
                <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06] text-emerald-400 font-mono flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>SQLite Synchronous WAL</span>
                </div>
                <span className="text-[11px] text-zinc-500 mt-1 block">Committed on every verified chunk ACK</span>
              </div>
            </div>
          </div>

          {/* Section: Storage Directories */}
          <div className="agnos-card p-6 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-white/[0.06]">
              <FolderOpen className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-semibold text-white">Storage & Vault Paths</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
              <div>
                <label className="block text-zinc-400 mb-1 font-sans font-medium">Received Vault Directory</label>
                <input
                  type="text"
                  value={settings.received_dir}
                  onChange={(e) => setSettings({ ...settings, received_dir: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-white/[0.03] border border-white/[0.08] text-zinc-300 focus:outline-none focus:border-agnos-vermilion"
                />
              </div>

              <div>
                <label className="block text-zinc-400 mb-1 font-sans font-medium">Database Ledger Path</label>
                <input
                  type="text"
                  value={settings.db_path}
                  disabled
                  className="w-full px-3.5 py-2 rounded-xl bg-white/[0.01] border border-white/[0.04] text-zinc-500 cursor-not-allowed"
                />
              </div>
            </div>
          </div>

          {/* Submit Action */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-xs font-semibold bg-agnos-vermilion text-white hover:bg-agnos-vermilion-hover shadow-lg shadow-agnos-vermilion/20 transition-all hover:scale-[1.02]"
            >
              <Save className="w-4 h-4" />
              Save Configuration
            </button>

            {saved && (
              <div className="flex items-center gap-2 text-xs text-emerald-400 font-mono">
                <CheckCircle2 className="w-4 h-4" />
                <span>Configuration updated successfully!</span>
              </div>
            )}
          </div>
        </form>
      </div>
    </AppShell>
  );
};

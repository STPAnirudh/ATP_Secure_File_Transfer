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
  Sun,
  Moon,
  Smartphone,
  Edit3,
  Check,
  Wifi,
  AlertTriangle,
} from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { NetworkQrCard } from '../components/NetworkQrCard';
import { api } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { useDevice } from '../context/DeviceContext';

export const SettingsPage: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const { deviceId, deviceName, renameDevice, connectedDevices } = useDevice();

  const [customDeviceName, setCustomDeviceName] = useState(deviceName);
  const [editingDevice, setEditingDevice] = useState(false);
  const [deviceSaved, setDeviceSaved] = useState(false);

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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
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
    setErrorMessage(null);
    try {
      await api.updateSettings(settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update settings');
      setTimeout(() => setErrorMessage(null), 4000);
    }
  };

  const handleDeviceRename = async () => {
    if (!customDeviceName.trim()) return;
    await renameDevice(customDeviceName.trim());
    setEditingDevice(false);
    setDeviceSaved(true);
    setTimeout(() => setDeviceSaved(false), 3000);
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
            Configure appearance theme, device identity, TCP socket parameters, buffer sizes, and local vault directories.
          </p>
        </div>

        {errorMessage && (
          <div className="mb-6 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Section: Appearance & Theme Mode */}
        <div className="agnos-card p-6 mb-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <Sun className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-semibold text-white">Interface Appearance & Theme</h2>
            </div>
            <span className="text-[11px] font-mono text-zinc-400">
              Active: {theme === 'dark' ? 'Dark Mode (Default)' : 'Light Mode'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setTheme('dark')}
              className={`p-4 rounded-2xl border text-left flex items-start gap-3.5 transition-all ${
                theme === 'dark'
                  ? 'bg-agnos-vermilion/10 border-agnos-vermilion shadow-lg shadow-agnos-vermilion/10'
                  : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]'
              }`}
            >
              <div className="w-9 h-9 rounded-xl bg-black/60 border border-white/[0.08] flex items-center justify-center text-indigo-400">
                <Moon className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-white flex items-center gap-2">
                  <span>Dark Mode</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-white/[0.08] text-zinc-400">
                    Default
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Deep obsidian palette inspired by Agnos studio with neon vermilion accents.
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setTheme('light')}
              className={`p-4 rounded-2xl border text-left flex items-start gap-3.5 transition-all ${
                theme === 'light'
                  ? 'bg-agnos-vermilion/10 border-agnos-vermilion shadow-lg shadow-agnos-vermilion/10'
                  : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]'
              }`}
            >
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <Sun className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-white">Light Mode</div>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Clean crisp high-contrast daylight theme optimized for outdoor or well-lit environments.
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* Section: Device Identity & Network Name */}
        <div className="agnos-card p-6 mb-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-semibold text-white">Device Identity & Custom Name</h2>
            </div>
            <span className="text-[11px] font-mono text-zinc-500">ID: {deviceId}</span>
          </div>

          <p className="text-xs text-zinc-400">
            Customize how this device appears to other peers on the network when sending or receiving files.
          </p>

          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex-1">
              <label className="text-[11px] font-mono text-zinc-400 block mb-1">Device Display Name</label>
              {!editingDevice ? (
                <div className="text-sm font-semibold text-white">{deviceName}</div>
              ) : (
                <input
                  type="text"
                  value={customDeviceName}
                  onChange={(e) => setCustomDeviceName(e.target.value)}
                  className="w-full max-w-sm px-3 py-1.5 rounded-lg bg-black/60 border border-agnos-vermilion text-xs text-white focus:outline-none"
                  autoFocus
                />
              )}
            </div>

            <div className="flex items-center gap-2">
              {!editingDevice ? (
                <button
                  type="button"
                  onClick={() => {
                    setCustomDeviceName(deviceName);
                    setEditingDevice(true);
                  }}
                  className="px-4 py-2 rounded-full text-xs font-medium bg-white/[0.06] hover:bg-white/[0.12] text-white border border-white/[0.08] transition-colors flex items-center gap-1.5"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Change Name
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleDeviceRename}
                    className="px-4 py-2 rounded-full text-xs font-semibold bg-agnos-vermilion hover:bg-agnos-vermilion-hover text-white transition-colors flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Save Name
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingDevice(false)}
                    className="px-3 py-2 rounded-full text-xs text-zinc-400 hover:text-white"
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>
          </div>

          {deviceSaved && (
            <div className="text-xs text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Device name saved and broadcasted to local network!</span>
            </div>
          )}
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
                  <option value={16384}>16 KB (High Loss / Unstable Wi-Fi)</option>
                  <option value={65536}>64 KB (ATP Default Recommended)</option>
                  <option value={131072}>128 KB (Fast LAN Network)</option>
                  <option value={262144}>256 KB (Gigabit Ethernet)</option>
                </select>
                <span className="text-[11px] text-zinc-500 mt-1 block">Size of atomic encrypted chunk payloads</span>
              </div>

              <div>
                <label className="block text-zinc-400 mb-1 font-medium">Cryptographic Cipher Suite</label>
                <input
                  type="text"
                  disabled
                  value={settings.cipher_suite}
                  className="w-full px-3.5 py-2 rounded-xl bg-white/[0.01] border border-white/[0.05] text-zinc-400 font-mono cursor-not-allowed"
                />
                <span className="text-[11px] text-zinc-500 mt-1 block">Galois/Counter Mode with 128-bit MAC tag</span>
              </div>
            </div>
          </div>

          {/* Section: Storage Directories */}
          <div className="agnos-card p-6 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-white/[0.06]">
              <HardDrive className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-semibold text-white">Storage Vault Paths</h2>
            </div>

            <div className="grid grid-cols-1 gap-4 text-xs font-mono">
              <div>
                <label className="block text-zinc-400 mb-1 font-sans font-medium">Received Vault Directory</label>
                <input
                  type="text"
                  value={settings.received_dir}
                  onChange={(e) => setSettings({ ...settings, received_dir: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white focus:outline-none focus:border-agnos-vermilion"
                />
                <span className="text-[11px] text-zinc-500 font-sans mt-1 block">Destination for assembled and verified transfers</span>
              </div>

              <div>
                <label className="block text-zinc-400 mb-1 font-sans font-medium">SQLite Checkpoint Ledger Database</label>
                <input
                  type="text"
                  value={settings.db_path}
                  onChange={(e) => setSettings({ ...settings, db_path: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white focus:outline-none focus:border-agnos-vermilion"
                />
                <span className="text-[11px] text-zinc-500 font-sans mt-1 block">WAL-mode SQLite database tracking atomic chunks</span>
              </div>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex items-center justify-between pt-2">
            <div>
              {saved && (
                <div className="flex items-center gap-2 text-xs text-emerald-400 font-medium">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Settings updated successfully</span>
                </div>
              )}
            </div>

            <button
              type="submit"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-xs font-semibold bg-agnos-vermilion text-white hover:bg-agnos-vermilion-hover shadow-lg shadow-agnos-vermilion/20 transition-all hover:scale-[1.02]"
            >
              <Save className="w-4 h-4" />
              Save Configuration
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
};

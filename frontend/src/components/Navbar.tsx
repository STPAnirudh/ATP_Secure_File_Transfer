import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Shield,
  ArrowRight,
  Terminal,
  QrCode,
  Sun,
  Moon,
  Smartphone,
  Wifi,
} from 'lucide-react';
import { api } from '../services/api';
import { ServerHealth } from '../types';
import { useTheme } from '../context/ThemeContext';
import { useDevice } from '../context/DeviceContext';
import { NetworkQrModal } from './NetworkQrModal';
import { ConnectedDevicesModal } from './ConnectedDevicesModal';

export const Navbar: React.FC = () => {
  const location = useLocation();
  const isApp = location.pathname.startsWith('/app');
  const [health, setHealth] = useState<ServerHealth | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showDevicesModal, setShowDevicesModal] = useState(false);

  const { theme, toggleTheme } = useTheme();
  const { deviceName, connectedDevices } = useDevice();

  useEffect(() => {
    const checkHealth = () => {
      api.getHealth()
        .then(setHealth)
        .catch(() => setHealth(null));
    };
    checkHealth();
    const interval = setInterval(checkHealth, 5000);
    return () => clearInterval(interval);
  }, []);

  const totalDevicesOnline = Math.max(
    connectedDevices.length,
    health?.active_devices_count || 1
  );

  return (
    <header className="sticky top-0 z-50 w-full backdrop-blur-xl bg-agnos-dark/85 border-b border-white/[0.06] transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand identity */}
        <div className="flex items-center gap-4 sm:gap-6">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-agnos-vermilion flex items-center justify-center text-white shadow-lg shadow-agnos-vermilion/20 group-hover:scale-105 transition-transform">
              <Shield className="w-4 h-4" />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-semibold tracking-tight text-white flex items-center gap-1.5">
                ATP <span className="w-1.5 h-1.5 rounded-full bg-agnos-vermilion"></span>
                <span className="text-xs font-normal text-zinc-400 hidden sm:inline">Engine</span>
              </span>
            </div>
          </Link>

          {/* Node health status pill (Clickable to open Devices Modal) */}
          <button
            onClick={() => setShowDevicesModal(true)}
            className="hidden sm:flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs transition-colors cursor-pointer text-left"
            title="Click to view connected devices and change your device name"
          >
            <span className={`w-2 h-2 rounded-full ${health ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
            <span className="text-zinc-300 font-mono">
              TCP :9000 {health ? 'Online' : 'Offline'}
            </span>
            {health && (
              <span className="text-zinc-400 font-mono text-[11px] pl-1.5 border-l border-white/[0.08] flex items-center gap-1">
                <Wifi className="w-3 h-3 text-emerald-400" />
                {totalDevicesOnline} {totalDevicesOnline === 1 ? 'device' : 'devices'}
              </span>
            )}
          </button>
        </div>

        {/* Center / Landing Page Navigation Links only (No duplicate links when in app) */}
        {!isApp && (
          <nav className="hidden lg:flex items-center gap-1 text-sm font-medium">
            <a href="#features" className="px-3.5 py-1.5 rounded-full text-zinc-300 hover:text-white hover:bg-white/[0.05] transition-colors whitespace-nowrap">
              Capabilities
            </a>
            <a href="#comparison" className="px-3.5 py-1.5 rounded-full text-zinc-300 hover:text-white hover:bg-white/[0.05] transition-colors whitespace-nowrap">
              HTTP vs ATP
            </a>
            <a href="#workflow" className="px-3.5 py-1.5 rounded-full text-zinc-300 hover:text-white hover:bg-white/[0.05] transition-colors whitespace-nowrap">
              Architecture
            </a>
            <Link to="/app/security" className="px-3.5 py-1.5 rounded-full text-zinc-300 hover:text-white hover:bg-white/[0.05] transition-colors whitespace-nowrap">
              Cryptography
            </Link>
          </nav>
        )}

        {/* Right CTA */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Theme Toggle Button (Light / Dark) */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-full text-zinc-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] transition-all hover:scale-105 cursor-pointer shrink-0"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle Theme"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-indigo-400" />
            )}
          </button>

          {/* Connected Devices Trigger Pill */}
          <button
            onClick={() => setShowDevicesModal(true)}
            className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-medium text-zinc-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] transition-all cursor-pointer shrink-0"
            title={`Your device: ${deviceName}. Click to manage name and view online peers.`}
          >
            <Smartphone className="w-3.5 h-3.5 text-agnos-vermilion" />
            <span className="hidden sm:inline max-w-[90px] truncate">{deviceName}</span>
          </button>

          {/* Quick Connect / QR Trigger Button */}
          <button
            onClick={() => setShowQrModal(true)}
            className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-medium text-zinc-300 hover:text-white bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.1] transition-all hover:scale-105 cursor-pointer shrink-0"
            title="Scan QR to connect from other devices on Wi-Fi"
          >
            <QrCode className="w-3.5 h-3.5 text-agnos-vermilion" />
            <span className="hidden sm:inline">Connect</span>
          </button>

          {!isApp ? (
            <Link
              to="/app"
              className="inline-flex items-center gap-2 px-3.5 sm:px-5 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium bg-agnos-vermilion text-white hover:bg-agnos-vermilion-hover shadow-lg shadow-agnos-vermilion/25 transition-all hover:scale-[1.02] active:scale-[0.98] shrink-0"
            >
              <span>Console</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          ) : (
            <div className="flex items-center gap-2 shrink-0">
              <Link
                to="/app/send"
                className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-full text-xs font-semibold bg-agnos-vermilion text-white hover:bg-agnos-vermilion-hover transition-colors shadow-md shadow-agnos-vermilion/20 shrink-0"
              >
                <Terminal className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">New Transfer</span>
                <span className="sm:hidden">Send</span>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Network QR Modal */}
      <NetworkQrModal isOpen={showQrModal} onClose={() => setShowQrModal(false)} />

      {/* Connected Devices Modal */}
      <ConnectedDevicesModal
        isOpen={showDevicesModal}
        onClose={() => setShowDevicesModal(false)}
        onOpenQr={() => setShowQrModal(true)}
      />
    </header>
  );
};

import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Shield, ArrowRight, Activity, Terminal, QrCode } from 'lucide-react';
import { api } from '../services/api';
import { ServerHealth } from '../types';
import { NetworkQrModal } from './NetworkQrModal';

export const Navbar: React.FC = () => {
  const location = useLocation();
  const isApp = location.pathname.startsWith('/app');
  const [health, setHealth] = useState<ServerHealth | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);

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

  return (
    <header className="sticky top-0 z-50 w-full backdrop-blur-xl bg-agnos-dark/85 border-b border-white/[0.06]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand identity */}
        <div className="flex items-center gap-6">
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

          {/* Node health status pill */}
          <div className="hidden sm:flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs">
            <span className={`w-2 h-2 rounded-full ${health ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
            <span className="text-zinc-300 font-mono">
              TCP :9000 {health ? 'Online' : 'Offline'}
            </span>
            {health && (
              <span className="text-zinc-400 font-mono text-[11px] pl-1.5 border-l border-white/[0.08]">
                {health.active_devices_count || 1} {(health.active_devices_count || 1) === 1 ? 'device' : 'devices'} online
                {health.tcp_active_connections > 0 ? ` • ${health.tcp_active_connections} active stream` : ''}
              </span>
            )}
          </div>
        </div>

        {/* Center / Navigation Links */}
        <nav className="hidden lg:flex items-center gap-1 text-sm font-medium">
          {!isApp ? (
            <>
              <a href="#features" className="px-3 py-1.5 rounded-full text-zinc-300 hover:text-white hover:bg-white/[0.05] transition-colors">
                Capabilities
              </a>
              <a href="#comparison" className="px-3 py-1.5 rounded-full text-zinc-300 hover:text-white hover:bg-white/[0.05] transition-colors">
                HTTP vs ATP
              </a>
              <a href="#workflow" className="px-3 py-1.5 rounded-full text-zinc-300 hover:text-white hover:bg-white/[0.05] transition-colors">
                Architecture
              </a>
              <Link to="/app/security" className="px-3 py-1.5 rounded-full text-zinc-300 hover:text-white hover:bg-white/[0.05] transition-colors">
                Cryptography
              </Link>
            </>
          ) : (
            <>
              <Link
                to="/app"
                className={`px-3 py-1.5 rounded-full transition-colors ${
                  location.pathname === '/app'
                    ? 'text-white bg-white/[0.1]'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.05]'
                }`}
              >
                Overview
              </Link>
              <Link
                to="/app/transfers"
                className={`px-3 py-1.5 rounded-full transition-colors ${
                  location.pathname === '/app/transfers'
                    ? 'text-white bg-white/[0.1]'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.05]'
                }`}
              >
                Transfers
              </Link>
              <Link
                to="/app/send"
                className={`px-3 py-1.5 rounded-full transition-colors ${
                  location.pathname === '/app/send'
                    ? 'text-white bg-white/[0.1]'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.05]'
                }`}
              >
                Send File
              </Link>
              <Link
                to="/app/received"
                className={`px-3 py-1.5 rounded-full transition-colors ${
                  location.pathname === '/app/received'
                    ? 'text-white bg-white/[0.1]'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.05]'
                }`}
              >
                Received Files
              </Link>
              <Link
                to="/app/activity"
                className={`px-3 py-1.5 rounded-full transition-colors ${
                  location.pathname === '/app/activity'
                    ? 'text-white bg-white/[0.1]'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.05]'
                }`}
              >
                Activity
              </Link>
              <Link
                to="/app/security"
                className={`px-3 py-1.5 rounded-full transition-colors ${
                  location.pathname === '/app/security'
                    ? 'text-white bg-white/[0.1]'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.05]'
                }`}
              >
                Security
              </Link>
              <Link
                to="/app/settings"
                className={`px-3 py-1.5 rounded-full transition-colors ${
                  location.pathname === '/app/settings'
                    ? 'text-white bg-white/[0.1]'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.05]'
                }`}
              >
                Settings
              </Link>
            </>
          )}
        </nav>

        {/* Right CTA */}
        <div className="flex items-center gap-3">
          {/* Quick Connect / QR Trigger Button */}
          <button
            onClick={() => setShowQrModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-zinc-300 hover:text-white bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.1] transition-all hover:scale-105"
            title="Scan QR to connect from other devices on Wi-Fi"
          >
            <QrCode className="w-3.5 h-3.5 text-agnos-vermilion" />
            <span className="hidden sm:inline">Connect</span> Device
          </button>

          {!isApp ? (
            <Link
              to="/app"
              className="inline-flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium bg-agnos-vermilion text-white hover:bg-agnos-vermilion-hover shadow-lg shadow-agnos-vermilion/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              Open Console
              <ArrowRight className="w-4 h-4" />
            </Link>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/"
                className="px-3.5 py-1.5 rounded-full text-xs font-medium text-zinc-300 hover:text-white hover:bg-white/[0.08] transition-colors border border-white/[0.08]"
              >
                Documentation
              </Link>
              <Link
                to="/app/send"
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold bg-agnos-vermilion text-white hover:bg-agnos-vermilion-hover transition-colors shadow-md shadow-agnos-vermilion/20"
              >
                <Terminal className="w-3.5 h-3.5" />
                New Transfer
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Network QR Modal */}
      <NetworkQrModal isOpen={showQrModal} onClose={() => setShowQrModal(false)} />
    </header>
  );
};

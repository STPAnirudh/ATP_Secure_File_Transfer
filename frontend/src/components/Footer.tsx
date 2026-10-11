import React from 'react';
import { Shield, Lock, Cpu, Database, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Footer: React.FC = () => {
  return (
    <footer className="mt-20 border-t border-white/[0.06] bg-agnos-dark pt-16 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main Footer Banner Card */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-white/[0.04] to-transparent border border-white/[0.08] p-8 sm:p-12 mb-16">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div className="max-w-xl">
              <span className="agnos-badge mb-4">
                <span className="w-1.5 h-1.5 rounded-full bg-agnos-vermilion"></span>
                READY FOR RESILIENT NETWORKS
              </span>
              <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-3">
                Fault-tolerant file transport engineered for high latency and drops.
              </h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Persistent byte offsets, authenticated chunks, and zero unverified writes. Resume multi-gigabyte transfers instantly from the exact interrupted byte.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              <Link
                to="/app/send"
                className="inline-flex items-center justify-center px-6 py-3 rounded-full text-sm font-semibold bg-agnos-vermilion text-white hover:bg-agnos-vermilion-hover transition-all shadow-lg shadow-agnos-vermilion/20 hover:scale-[1.02]"
              >
                Launch Transfer Node
              </Link>
              <Link
                to="/app/security"
                className="inline-flex items-center justify-center px-6 py-3 rounded-full text-sm font-medium text-zinc-300 hover:text-white bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] transition-colors"
              >
                Verify Cryptography
              </Link>
            </div>
          </div>
          {/* Subtle background glow */}
          <div className="absolute -right-20 -bottom-20 w-96 h-96 bg-agnos-vermilion/10 rounded-full blur-3xl pointer-events-none" />
        </div>

        {/* Footer Links & Specs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 pb-12 border-b border-white/[0.06]">
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-agnos-vermilion flex items-center justify-center text-white">
                <Shield className="w-3.5 h-3.5" />
              </div>
              <span className="font-bold tracking-tight text-white">ATP Transport</span>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed mb-4">
              Agnos Transfer Protocol is a secure TCP application-layer file transmission engine featuring AES-256-GCM authenticated encryption and atomic checkpoint recovery.
            </p>
            <div className="flex items-center gap-2 text-xs text-zinc-500 font-mono">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Version 1.0.0 (Protocol ATP1)</span>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-300 mb-4">
              Core Protocol
            </h4>
            <ul className="space-y-2.5 text-xs text-zinc-400">
              <li className="flex items-center gap-2">
                <Cpu className="w-3.5 h-3.5 text-zinc-500" />
                <span>Explicit 4-byte Magic Framing</span>
              </li>
              <li className="flex items-center gap-2">
                <Database className="w-3.5 h-3.5 text-zinc-500" />
                <span>64 KB Bounded Chunk Transmission</span>
              </li>
              <li className="flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-zinc-500" />
                <span>Concurrent Multi-Client Pooling</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-zinc-500" />
                <span>Atomic SQLite Checkpoints</span>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-300 mb-4">
              Cryptographic Suite
            </h4>
            <ul className="space-y-2.5 text-xs text-zinc-400">
              <li>Cipher: <strong className="text-zinc-200">AES-256-GCM</strong></li>
              <li>Key Exchange: <strong className="text-zinc-200">X25519 + HKDF-SHA256</strong></li>
              <li>Authentication Tag: <strong className="text-zinc-200">128-bit Poly1305 / GHASH</strong></li>
              <li>Nonce: <strong className="text-zinc-200">96-bit Unique Per Chunk</strong></li>
              <li>Integrity: <strong className="text-zinc-200">End-to-End SHA-256 Digest</strong></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-300 mb-4">
              Console Navigation
            </h4>
            <ul className="space-y-2 text-xs text-zinc-400">
              <li>
                <Link to="/app" className="hover:text-white transition-colors">Server Overview</Link>
              </li>
              <li>
                <Link to="/app/transfers" className="hover:text-white transition-colors">Transfer History & Resume</Link>
              </li>
              <li>
                <Link to="/app/send" className="hover:text-white transition-colors">Transmit File via TCP</Link>
              </li>
              <li>
                <Link to="/app/received" className="hover:text-white transition-colors">Received Files Vault</Link>
              </li>
              <li>
                <Link to="/app/activity" className="hover:text-white transition-colors">Network Activity Audit</Link>
              </li>
              <li>
                <Link to="/app/security" className="hover:text-white transition-colors">Cryptographic Audit</Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-zinc-500 gap-4">
          <p>© 2026 ATP Network. Built with Google Antigravity. Inspired by Agnos visual aesthetics.</p>
          <div className="flex items-center gap-6">
            <span>TCP Engine :9000</span>
            <span>FastAPI Control :8000</span>
            <span>Local Node: 127.0.0.1</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

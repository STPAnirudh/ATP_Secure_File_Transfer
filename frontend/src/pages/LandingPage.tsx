import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Shield,
  ArrowRight,
  Lock,
  Cpu,
  Database,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Zap,
  Layers,
  Terminal,
  Activity,
  ChevronRight,
  Key,
} from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { ProtocolVisualizer } from '../components/ProtocolVisualizer';
import { api } from '../services/api';
import { ServerHealth } from '../types';

export const LandingPage: React.FC = () => {
  const [health, setHealth] = useState<ServerHealth | null>(null);

  useEffect(() => {
    api.getHealth()
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  return (
    <div className="min-h-screen bg-agnos-dark text-white selection:bg-agnos-vermilion selection:text-white">
      <Navbar />

      {/* HERO SECTION */}
      <section className="relative pt-20 pb-28 overflow-hidden">
        {/* Subtle background ambient lights */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[450px] bg-agnos-vermilion/10 rounded-full blur-[130px] pointer-events-none" />
        <div className="absolute top-10 right-10 w-72 h-72 bg-blue-500/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            {/* Pill badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs font-medium text-zinc-300 mb-8 backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-agnos-vermilion animate-ping" />
              <span>ATP v1.0 • AES-256-GCM + Atomic Resume Engine</span>
            </div>

            {/* Agnos-styled Headline */}
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tightest leading-[1.08] mb-6">
              Deterministic file transfer that{' '}
              <span className="font-editorial text-agnos-vermilion font-normal tracking-normal text-5xl sm:text-7xl lg:text-8xl inline-block -rotate-2">
                never drops
              </span>{' '}
              midway.
            </h1>

            {/* Lead description */}
            <p className="text-base sm:text-xl text-zinc-400 font-normal leading-relaxed max-w-2xl mx-auto mb-10">
              A high-performance TCP transport network with authenticated AEAD encryption, multi-client concurrency, and verified persistent resumption from the exact interrupted byte.
            </p>

            {/* Dual CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/app/send"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-3.5 rounded-full text-sm font-semibold bg-agnos-vermilion text-white hover:bg-agnos-vermilion-hover shadow-xl shadow-agnos-vermilion/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <Terminal className="w-4 h-4" />
                Launch Transfer Console
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/app/transfers"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full text-sm font-medium text-zinc-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] transition-colors"
              >
                Inspect Live Transfers
              </Link>
            </div>

            {/* Quick status line */}
            <div className="mt-12 flex items-center justify-center gap-6 text-xs text-zinc-500 font-mono">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Zero Unverified Writes</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Bounded 64KB Chunks</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>ECDH Forward Secrecy</span>
              </div>
            </div>
          </div>

          {/* Interactive Protocol Preview Mockup Frame */}
          <div className="mt-16 max-w-5xl mx-auto rounded-3xl bg-white/[0.02] border border-white/[0.1] p-4 sm:p-8 backdrop-blur-2xl shadow-2xl shadow-black/80">
            <div className="flex items-center justify-between pb-6 mb-6 border-b border-white/[0.06]">
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-rose-500/80" />
                  <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                </div>
                <span className="text-xs font-mono text-zinc-400">
                  atp://node-01.local:9000/stream
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>TCP STREAM ESTABLISHED (AES-256-GCM)</span>
              </div>
            </div>

            {/* Mock live transfer visualizer */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5">
                <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
                  <span>Transfer Session</span>
                  <span className="font-mono text-zinc-300">#atp-982f</span>
                </div>
                <div className="text-lg font-bold text-white mb-1">dataset-large-archive.tar.gz</div>
                <div className="text-xs text-zinc-400 font-mono mb-4">482.4 MB • 7,719 chunks</div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-zinc-400">Transferred: 368.5 MB</span>
                    <span className="text-agnos-vermilion font-bold">76.4%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-white/[0.06] overflow-hidden">
                    <div className="w-[76.4%] h-full rounded-full bg-agnos-vermilion" />
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2 text-[11px] text-emerald-400 font-mono">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>5,897 AEAD Tags Verified</span>
                </div>
              </div>

              <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5">
                <div className="text-xs text-zinc-400 mb-2">Resumption Checkpoint Engine</div>
                <div className="space-y-3 font-mono text-xs">
                  <div className="flex justify-between p-2 rounded bg-black/40 border border-white/[0.04]">
                    <span className="text-zinc-400">Last Acked Offset</span>
                    <span className="text-zinc-200">386,400,256 B</span>
                  </div>
                  <div className="flex justify-between p-2 rounded bg-black/40 border border-white/[0.04]">
                    <span className="text-zinc-400">Server Partial File</span>
                    <span className="text-emerald-400">VALIDATED ON DISK</span>
                  </div>
                  <div className="flex justify-between p-2 rounded bg-black/40 border border-white/[0.04]">
                    <span className="text-zinc-400">Drop Recovery Time</span>
                    <span className="text-cyan-400">&lt; 14 ms</span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5">
                <div className="text-xs text-zinc-400 mb-2">Cryptographic Identity</div>
                <div className="space-y-2 text-xs">
                  <div>
                    <div className="text-zinc-500 text-[11px]">Session Cipher</div>
                    <div className="font-mono text-white font-medium">AES-256-GCM (RFC 5116)</div>
                  </div>
                  <div>
                    <div className="text-zinc-500 text-[11px]">Key Exchange</div>
                    <div className="font-mono text-white font-medium">X25519 Ephemeral ECDH</div>
                  </div>
                  <div>
                    <div className="text-zinc-500 text-[11px]">Integrity Digest</div>
                    <div className="font-mono text-emerald-400 text-[11px] truncate">
                      SHA256: e3b0c44298fc1c149afbf4c8996fb9...
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* COMPARISON SECTION — Closely adapted from Agnos "Other agencies vs Agnos" */}
      <section id="comparison" className="py-24 border-t border-white/[0.06] bg-white/[0.01]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="agnos-badge mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-agnos-vermilion"></span>
              ARCHITECTURAL COMPARISON
            </span>
            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight mb-4">
              Why traditional file transfers fail on real networks.
            </h2>
            <p className="text-zinc-400 text-sm sm:text-base">
              Ordinary HTTP multi-part uploads and legacy FTP connections were never engineered for unpredictable packet loss, high-latency wireless networks, and active adversaries.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* Traditional Transfers Card */}
            <div className="rounded-3xl bg-white/[0.02] border border-rose-500/20 p-8 relative overflow-hidden">
              <div className="flex items-center justify-between mb-6">
                <span className="text-xs font-semibold uppercase tracking-wider text-rose-400 font-mono">
                  Traditional HTTP / Sockets
                </span>
                <span className="px-3 py-1 rounded-full text-xs bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  Brittle & Insecure
                </span>
              </div>
              <h3 className="text-xl font-bold text-white mb-6">Fragile & Blind Uploads</h3>

              <ul className="space-y-4 text-sm text-zinc-400">
                <li className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                    ✕
                  </div>
                  <span><strong>100% loss on disconnect:</strong> Socket drop requires complete retransmission of multi-gigabyte files.</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                    ✕
                  </div>
                  <span><strong>Blind server writes:</strong> Corrupt or truncated chunks are written directly to disk without verification.</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                    ✕
                  </div>
                  <span><strong>Memory bloat:</strong> Multipart uploads buffer massive payloads in RAM, degrading server capacity.</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                    ✕
                  </div>
                  <span><strong>Silent tampering:</strong> No authenticated ciphertext verification per chunk, exposing files to MITM alteration.</span>
                </li>
              </ul>
            </div>

            {/* ATP Protocol Card */}
            <div className="rounded-3xl bg-gradient-to-b from-white/[0.05] to-white/[0.02] border border-agnos-vermilion/40 p-8 relative overflow-hidden shadow-xl shadow-agnos-vermilion/5">
              <div className="flex items-center justify-between mb-6">
                <span className="text-xs font-semibold uppercase tracking-wider text-agnos-vermilion font-mono">
                  ATP Network Protocol
                </span>
                <span className="px-3 py-1 rounded-full text-xs bg-agnos-vermilion/15 text-agnos-vermilion border border-agnos-vermilion/30">
                  Resilient & Authenticated
                </span>
              </div>
              <h3 className="text-xl font-bold text-white mb-6">Deterministic Wire Transport</h3>

              <ul className="space-y-4 text-sm text-zinc-300">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-agnos-vermilion flex-shrink-0 mt-0.5" />
                  <span><strong>Instant offset resumption:</strong> SQLite tracks confirmed byte offsets. Reconnection resumes immediately.</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-agnos-vermilion flex-shrink-0 mt-0.5" />
                  <span><strong>AES-256-GCM authentication:</strong> Every chunk carries a 128-bit MAC tag verified before writing to disk.</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-agnos-vermilion flex-shrink-0 mt-0.5" />
                  <span><strong>Bounded 64KB zero-copy:</strong> Fixed buffer sizes guarantee low memory footprint even with 100+ clients.</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-agnos-vermilion flex-shrink-0 mt-0.5" />
                  <span><strong>Full SHA-256 validation:</strong> Assembled file is independently hashed and checked against the expected digest.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CORE CAPABILITIES BENTO GRID */}
      <section id="features" className="py-24 border-t border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="agnos-badge mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-agnos-vermilion"></span>
              CORE CAPABILITIES
            </span>
            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight mb-4">
              Engineered for uncompromising integrity.
            </h2>
            <p className="text-zinc-400 text-sm sm:text-base">
              A clean separation of TCP data stream, cryptographic verification, persistent metadata, and HTTP control plane.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Bento Card 1 */}
            <div className="agnos-card agnos-card-hover p-8 md:col-span-2">
              <div className="w-12 h-12 rounded-2xl bg-agnos-vermilion/10 border border-agnos-vermilion/20 flex items-center justify-center text-agnos-vermilion mb-6">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">
                AES-256-GCM Authenticated Encryption
              </h3>
              <p className="text-sm text-zinc-400 leading-relaxed mb-6">
                Every chunk transmitted over the TCP socket is encrypted using AES in Galois/Counter Mode (GCM). An independent 96-bit nonce is generated for every chunk under the negotiated session key, accompanied by a 128-bit authentication tag that guarantees data confidentiality and integrity.
              </p>
              <div className="flex flex-wrap gap-2 text-xs font-mono text-zinc-300">
                <span className="px-3 py-1 rounded-full bg-white/[0.05] border border-white/[0.08]">256-bit Key</span>
                <span className="px-3 py-1 rounded-full bg-white/[0.05] border border-white/[0.08]">96-bit Nonce</span>
                <span className="px-3 py-1 rounded-full bg-white/[0.05] border border-white/[0.08]">128-bit Tag</span>
                <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Tamper Rejection</span>
              </div>
            </div>

            {/* Bento Card 2 */}
            <div className="agnos-card agnos-card-hover p-8">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-6">
                <RotateCcw className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">
                Persistent Checkpoint Resumption
              </h3>
              <p className="text-sm text-zinc-400 leading-relaxed mb-4">
                Interrupted transfers can be resumed at any time. The server cross-validates existing partial files against stored chunk checkpoints before confirming the resume byte offset.
              </p>
              <div className="text-xs font-mono text-cyan-400">
                &gt; Atomic SQLite State Ledger
              </div>
            </div>

            {/* Bento Card 3 */}
            <div className="agnos-card agnos-card-hover p-8">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-6">
                <Cpu className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">
                Multi-Client Concurrency
              </h3>
              <p className="text-sm text-zinc-400 leading-relaxed mb-4">
                Handles multiple concurrent transfer clients with isolated session keys, independent buffer queues, and non-blocking socket loops.
              </p>
              <div className="text-xs font-mono text-amber-400">
                &gt; Thread-Safe Client Contexts
              </div>
            </div>

            {/* Bento Card 4 */}
            <div className="agnos-card agnos-card-hover p-8 md:col-span-2">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-6">
                <Key className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">
                X25519 Ephemeral Key Negotiation & SHA-256 Digest
              </h3>
              <p className="text-sm text-zinc-400 leading-relaxed mb-6">
                Session keys are never transmitted across the network. The client and server perform an ephemeral ECDH key exchange over Curve25519 and derive symmetric AES keys using HKDF-SHA256. Upon final reassembly, a full SHA-256 digest comparison guarantees byte-for-byte fidelity.
              </p>
              <div className="flex flex-wrap gap-2 text-xs font-mono text-zinc-300">
                <span className="px-3 py-1 rounded-full bg-white/[0.05] border border-white/[0.08]">Curve25519</span>
                <span className="px-3 py-1 rounded-full bg-white/[0.05] border border-white/[0.08]">HKDF-SHA256 Derivation</span>
                <span className="px-3 py-1 rounded-full bg-white/[0.05] border border-white/[0.08]">End-to-End SHA-256 Digest</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TECHNICAL FRAMING DIAGRAM */}
      <section id="workflow" className="py-24 border-t border-white/[0.06] bg-white/[0.01]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="agnos-badge mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-agnos-vermilion"></span>
              APPLICATION LAYER FRAMING
            </span>
            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight mb-4">
              Protocol Framing Specification
            </h2>
            <p className="text-zinc-400 text-sm sm:text-base">
              Explicit length prefix framing prevents TCP byte-stream fragmentation issues and ensures reliable message reassembly.
            </p>
          </div>

          <div className="max-w-5xl mx-auto">
            <ProtocolVisualizer />
          </div>
        </div>
      </section>

      {/* FINAL CALL TO ACTION */}
      <section className="py-24 border-t border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative rounded-3xl bg-gradient-to-r from-agnos-card via-black to-agnos-card border border-white/[0.1] p-10 sm:p-16 text-center overflow-hidden">
            <div className="relative z-10 max-w-2xl mx-auto">
              <span className="agnos-badge mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-agnos-vermilion"></span>
                ACTIVE LOCAL NODE
              </span>
              <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white mb-6">
                Ready to transfer files with mathematical certainty?
              </h2>
              <p className="text-sm sm:text-base text-zinc-400 mb-10 leading-relaxed">
                Connect directly to your local TCP transfer engine. Send files of any size, simulate network interruptions, and verify atomic resumption in real time.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  to="/app/send"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full text-sm font-semibold bg-agnos-vermilion text-white hover:bg-agnos-vermilion-hover shadow-xl shadow-agnos-vermilion/25 transition-all hover:scale-[1.02]"
                >
                  <Terminal className="w-4 h-4" />
                  Transmit File Now
                </Link>
                <Link
                  to="/app/security"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full text-sm font-medium text-zinc-300 hover:text-white bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] transition-colors"
                >
                  Security Parameters
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

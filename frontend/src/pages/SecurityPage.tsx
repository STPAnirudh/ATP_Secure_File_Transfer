import React, { useEffect, useState } from 'react';
import {
  Shield,
  Key,
  Lock,
  FileCheck2,
  AlertOctagon,
  RefreshCw,
  Cpu,
  CheckCircle2,
  Info,
} from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { api } from '../services/api';
import { SecurityStatus } from '../types';

export const SecurityPage: React.FC = () => {
  const [security, setSecurity] = useState<SecurityStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSecurity = async () => {
    try {
      const data = await api.getSecurityStatus();
      setSecurity(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSecurity();
    const interval = setInterval(loadSecurity, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <AppShell>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <span className="agnos-badge mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-agnos-vermilion"></span>
            CRYPTOGRAPHIC AUDIT
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Security & Cryptographic Parameters
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Active cipher suites, ephemeral key negotiation state, and cryptographic integrity boundaries.
          </p>
        </div>

        <button
          onClick={() => {
            setLoading(true);
            loadSecurity();
          }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-xs font-medium text-zinc-300 border border-white/[0.08] transition-colors self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Parameters
        </button>
      </div>

      {/* Grid of Cryptographic Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="agnos-card p-5">
          <div className="w-10 h-10 rounded-xl bg-agnos-vermilion/10 text-agnos-vermilion flex items-center justify-center mb-3">
            <Lock className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-semibold text-white mb-1">Authenticated Cipher</h3>
          <div className="font-mono text-xs text-zinc-300 font-bold mb-1">
            {security?.cipher_suite || 'AES-256-GCM'}
          </div>
          <p className="text-[11px] text-zinc-400">
            Confidentiality & chunk authentication tag (128-bit MAC).
          </p>
        </div>

        <div className="agnos-card p-5">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mb-3">
            <Key className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-semibold text-white mb-1">Key Establishment</h3>
          <div className="font-mono text-xs text-zinc-300 font-bold mb-1">
            {security?.key_exchange || 'X25519 + HKDF'}
          </div>
          <p className="text-[11px] text-zinc-400">
            Ephemeral Diffie-Hellman forward secrecy per session.
          </p>
        </div>

        <div className="agnos-card p-5">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-3">
            <FileCheck2 className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-semibold text-white mb-1">Integrity Digest</h3>
          <div className="font-mono text-xs text-zinc-300 font-bold mb-1">
            SHA-256
          </div>
          <p className="text-[11px] text-zinc-400">
            Full-file pre/post transmission cryptographic digest check.
          </p>
        </div>

        <div className="agnos-card p-5">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-3">
            <AlertOctagon className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-semibold text-white mb-1">Anti-Replay / Nonce</h3>
          <div className="font-mono text-xs text-zinc-300 font-bold mb-1">
            96-bit Unique Nonce
          </div>
          <p className="text-[11px] text-zinc-400">
            Monotonically strictly incremented IV per chunk stream.
          </p>
        </div>
      </div>

      {/* Crucial Concept Clarification: Why each layer exists */}
      <div className="agnos-card p-6 mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Info className="w-4 h-4 text-agnos-vermilion" />
          <h2 className="text-base font-semibold text-white tracking-tight">
            Cryptographic Defense in Depth: Role Distinction
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs leading-relaxed text-zinc-300">
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
            <strong className="text-white block mb-1 text-sm">1. Secure Key Establishment vs Hardcoded Secrets</strong>
            <p className="text-zinc-400">
              Raw symmetric keys are <strong>never</strong> transmitted over the network or saved in source code. Client and server exchange Curve25519 ephemeral public keys and derive a distinct 256-bit symmetric session key via HKDF. Compromise of past keys cannot decrypt future traffic (forward secrecy).
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
            <strong className="text-white block mb-1 text-sm">2. AES-GCM Authentication Tags vs Encryption Alone</strong>
            <p className="text-zinc-400">
              Encryption (AES-CTR/CBC) only hides content; an adversary could flip bits without knowing the plaintext. AES-GCM produces a 128-bit authentication tag over the ciphertext and header. If a single bit is modified, decryption immediately raises a fatal authentication error.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
            <strong className="text-white block mb-1 text-sm">3. End-to-End SHA-256 vs Per-Chunk GCM Tags</strong>
            <p className="text-zinc-400">
              Chunk-level GCM tags verify that each 64 KB segment was not tampered with in transit. However, SHA-256 verifies that the entire reassembled file on the receiving disk matches the original source file bit-for-bit, catching disk corruption, chunk reordering, or missing bytes.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
            <strong className="text-white block mb-1 text-sm">4. Server Resume Offset Validation</strong>
            <p className="text-zinc-400">
              When a client attempts to resume an interrupted transfer, the server never blindly trusts the client's claimed byte offset. The server cross-references its SQLite checkpoint ledger and verifies actual byte length on disk before consenting to resume.
            </p>
          </div>
        </div>
      </div>

      {/* Security Audit Trail */}
      <div>
        <h2 className="text-base font-semibold text-white tracking-tight mb-4">
          Cryptographic Audit Events Log
        </h2>

        {security?.audit_logs && security.audit_logs.length > 0 ? (
          <div className="agnos-card overflow-hidden">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-white/[0.03] border-b border-white/[0.06] text-zinc-400">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Event</th>
                  <th className="py-3 px-4">Cipher Suite</th>
                  <th className="py-3 px-4">Key Exchange</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {security.audit_logs.map((log) => (
                  <tr key={log.id} className="hover:bg-white/[0.02]">
                    <td className="py-3 px-4 text-zinc-500 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="py-3 px-4 font-semibold text-white">
                      {log.event}
                    </td>
                    <td className="py-3 px-4 text-zinc-300">
                      {log.cipher_suite}
                    </td>
                    <td className="py-3 px-4 text-zinc-300">
                      {log.key_exchange}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {log.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-zinc-400 font-sans">
                      {log.details}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="agnos-card p-8 text-center text-xs text-zinc-500">
            No active cryptographic security exceptions or audit warnings.
          </div>
        )}
      </div>
    </AppShell>
  );
};

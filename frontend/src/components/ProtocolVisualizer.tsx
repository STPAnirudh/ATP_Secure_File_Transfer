import React from 'react';
import { Layers, ShieldCheck, Binary, RefreshCw } from 'lucide-react';

export const ProtocolVisualizer: React.FC = () => {
  return (
    <div className="rounded-2xl bg-white/[0.02] border border-white/[0.08] p-6 text-xs">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Binary className="w-4 h-4 text-agnos-vermilion" />
          <h4 className="font-semibold text-white tracking-tight">ATP Framing & Byte Header Specification</h4>
        </div>
        <span className="agnos-badge">Length-Prefixed TCP Stream</span>
      </div>

      <p className="text-zinc-400 mb-4 leading-relaxed">
        Every message over the TCP socket is framed with a deterministic header enabling clean stream reconstruction, bounded buffering, and tamper rejection before decryption.
      </p>

      {/* Frame diagram */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 font-mono text-[11px] mb-4">
        <div className="rounded-lg bg-agnos-vermilion/10 border border-agnos-vermilion/30 p-2.5 text-center">
          <div className="text-zinc-400 text-[10px] uppercase">Magic</div>
          <div className="text-agnos-vermilion font-bold mt-1">4 bytes</div>
          <div className="text-zinc-300 text-[10px] mt-0.5">ATP1</div>
        </div>

        <div className="rounded-lg bg-white/[0.04] border border-white/[0.08] p-2.5 text-center">
          <div className="text-zinc-400 text-[10px] uppercase">Msg Type</div>
          <div className="text-white font-bold mt-1">1 byte</div>
          <div className="text-zinc-400 text-[10px] mt-0.5">0x01 - 0x0C</div>
        </div>

        <div className="rounded-lg bg-white/[0.04] border border-white/[0.08] p-2.5 text-center">
          <div className="text-zinc-400 text-[10px] uppercase">Transfer ID</div>
          <div className="text-white font-bold mt-1">16 bytes</div>
          <div className="text-zinc-400 text-[10px] mt-0.5">UUID v4</div>
        </div>

        <div className="rounded-lg bg-white/[0.04] border border-white/[0.08] p-2.5 text-center">
          <div className="text-zinc-400 text-[10px] uppercase">Byte Offset</div>
          <div className="text-white font-bold mt-1">8 bytes</div>
          <div className="text-zinc-400 text-[10px] mt-0.5">uint64 (BE)</div>
        </div>

        <div className="rounded-lg bg-white/[0.04] border border-white/[0.08] p-2.5 text-center">
          <div className="text-zinc-400 text-[10px] uppercase">Chunk Len</div>
          <div className="text-white font-bold mt-1">4 bytes</div>
          <div className="text-zinc-400 text-[10px] mt-0.5">uint32 (BE)</div>
        </div>

        <div className="rounded-lg bg-cyan-500/10 border border-cyan-500/30 p-2.5 text-center">
          <div className="text-zinc-400 text-[10px] uppercase">GCM Nonce</div>
          <div className="text-cyan-400 font-bold mt-1">12 bytes</div>
          <div className="text-zinc-400 text-[10px] mt-0.5">96-bit unique</div>
        </div>

        <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-2.5 text-center">
          <div className="text-zinc-400 text-[10px] uppercase">Auth Tag</div>
          <div className="text-emerald-400 font-bold mt-1">16 bytes</div>
          <div className="text-zinc-400 text-[10px] mt-0.5">128-bit MAC</div>
        </div>
      </div>

      {/* Payload row */}
      <div className="rounded-lg bg-white/[0.02] border border-dashed border-white/[0.12] p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-zinc-400" />
          <span className="text-zinc-300 font-medium">Ciphertext Payload:</span>
          <span className="text-zinc-400 font-mono text-[11px]">Up to 65,536 bytes (AES-256-GCM encrypted file chunk)</span>
        </div>
        <div className="flex items-center gap-2 text-emerald-400 font-mono text-[11px]">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>AEAD Tag Checked Prior to File Write</span>
        </div>
      </div>
    </div>
  );
};

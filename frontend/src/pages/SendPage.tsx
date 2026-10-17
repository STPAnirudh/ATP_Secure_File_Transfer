import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UploadCloud,
  FileText,
  Lock,
  ShieldCheck,
  Zap,
  RotateCw,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Terminal,
  Radio,
  Smartphone,
  Share2,
} from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { ProtocolVisualizer } from '../components/ProtocolVisualizer';
import { api } from '../services/api';
import { useDevice } from '../context/DeviceContext';

export const SendPage: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { deviceId, deviceName, connectedDevices } = useDevice();

  const [file, setFile] = useState<File | null>(null);
  const [targetMode, setTargetMode] = useState<'broadcast' | 'direct'>('broadcast');
  const [selectedTargetDevice, setSelectedTargetDevice] = useState<string>('broadcast');

  const [simulateDrop, setSimulateDrop] = useState(false);
  const [dropAfterChunks, setDropAfterChunks] = useState(3);
  const [uploading, setUploading] = useState(false);
  const [transferId, setTransferId] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

  // Other online devices (excluding self)
  const peerDevices = connectedDevices.filter((d) => d.device_id !== deviceId);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
      setCompleted(false);
      setProgress(0);
      setStatusMessage('');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      setError(null);
      setCompleted(false);
      setProgress(0);
      setStatusMessage('');
    }
  };

  const calculateChunks = (size: number) => {
    const CHUNK_SIZE = 64 * 1024;
    return Math.ceil(size / CHUNK_SIZE) || 1;
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleStartTransfer = async () => {
    if (!file) return;

    setUploading(true);
    setError(null);
    setProgress(15);
    setStatusMessage('Initiating TCP Connection with Node :9000...');

    const progressTimer = setInterval(() => {
      setProgress((prev) => {
        if (prev < 85) return prev + 10;
        return prev;
      });
    }, 200);

    try {
      const formData = new FormData();
      formData.append('file', file);
      if (simulateDrop) {
        formData.append('simulate_drop_after_chunks', dropAfterChunks.toString());
      }

      // Target recipient
      const finalTarget = targetMode === 'broadcast' ? 'broadcast' : selectedTargetDevice;
      formData.append('target_device_id', finalTarget);
      formData.append('sender_device_id', deviceId);

      setStatusMessage('Negotiating X25519 Ephemeral Key & Deriving AES-256-GCM Key...');
      setProgress(35);

      const res = await api.initiateTransfer(formData);
      clearInterval(progressTimer);
      setTransferId(res.transfer_id);

      if (res.interrupted) {
        setProgress(50);
        setStatusMessage(
          `Deliberate network interruption simulated at chunk #${dropAfterChunks}. Checkpoint successfully saved in SQLite!`
        );
        setUploading(false);
      } else {
        setProgress(100);
        setStatusMessage('All chunks encrypted with AES-GCM and verified with SHA-256 digest!');
        setCompleted(true);
        setUploading(false);
      }
    } catch (err: any) {
      clearInterval(progressTimer);
      let errMsg = err.message || 'Transfer failed';
      try {
        const parsed = JSON.parse(errMsg);
        if (parsed.detail) errMsg = parsed.detail;
      } catch {}
      setError(errMsg);
      setUploading(false);
    }
  };

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <span className="agnos-badge mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-agnos-vermilion"></span>
            TCP TRANSMISSION INITIATOR
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Send File via Encrypted TCP Stream
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Transmits file in bounded 64 KB chunks framed with AES-256-GCM authenticated ciphertexts over TCP sockets.
          </p>
        </div>

        {/* Drag and Drop Zone */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="agnos-card border-2 border-dashed border-white/[0.12] hover:border-agnos-vermilion/50 p-10 text-center cursor-pointer transition-all mb-8 group"
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
          />

          <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.08] group-hover:scale-105 group-hover:border-agnos-vermilion/40 flex items-center justify-center mx-auto text-zinc-400 group-hover:text-agnos-vermilion transition-all mb-4">
            <UploadCloud className="w-7 h-7" />
          </div>

          <h3 className="text-base font-semibold text-white mb-1">
            {file ? file.name : 'Choose a file or drag & drop here'}
          </h3>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto">
            {file
              ? `${formatBytes(file.size)} • ${calculateChunks(file.size)} chunks to transmit`
              : 'Support for documents, archives, binaries, or media of any size.'}
          </p>
        </div>

        {/* File Details & Options */}
        {file && (
          <div className="agnos-card p-6 mb-8 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-white/[0.06]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-agnos-vermilion/10 text-agnos-vermilion flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white truncate max-w-sm">{file.name}</h4>
                  <div className="flex items-center gap-2 text-xs font-mono text-zinc-400 mt-0.5">
                    <span>{formatBytes(file.size)}</span>
                    <span>•</span>
                    <span>{calculateChunks(file.size)} Chunks (64 KB each)</span>
                  </div>
                </div>
              </div>

              <span className="agnos-badge">Ready for Wire</span>
            </div>

            {/* Target Delivery Destination (Broadcast vs Direct Device) */}
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
              <div className="text-xs font-semibold text-white mb-2 flex items-center gap-2">
                <Share2 className="w-4 h-4 text-agnos-vermilion" />
                <span>Delivery Recipient</span>
              </div>
              <p className="text-xs text-zinc-400 mb-3">
                Choose whether this file is public to all network devices or delivered exclusively to a chosen device.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                {/* Broadcast Option */}
                <label
                  onClick={() => {
                    setTargetMode('broadcast');
                    setSelectedTargetDevice('broadcast');
                  }}
                  className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${
                    targetMode === 'broadcast'
                      ? 'bg-agnos-vermilion/10 border-agnos-vermilion text-white'
                      : 'bg-white/[0.02] border-white/[0.08] text-zinc-400 hover:text-white'
                  }`}
                >
                  <input
                    type="radio"
                    name="targetMode"
                    checked={targetMode === 'broadcast'}
                    onChange={() => {}}
                    className="text-agnos-vermilion focus:ring-agnos-vermilion"
                  />
                  <div>
                    <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                      <Radio className="w-3.5 h-3.5 text-agnos-vermilion" />
                      Broadcast on Wi-Fi
                    </div>
                    <span className="text-[11px] text-zinc-400">Available to all connected peers</span>
                  </div>
                </label>

                {/* Direct to Device Option */}
                <label
                  onClick={() => {
                    setTargetMode('direct');
                    if (peerDevices.length > 0 && selectedTargetDevice === 'broadcast') {
                      setSelectedTargetDevice(peerDevices[0].device_id);
                    }
                  }}
                  className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${
                    targetMode === 'direct'
                      ? 'bg-agnos-vermilion/10 border-agnos-vermilion text-white'
                      : 'bg-white/[0.02] border-white/[0.08] text-zinc-400 hover:text-white'
                  }`}
                >
                  <input
                    type="radio"
                    name="targetMode"
                    checked={targetMode === 'direct'}
                    onChange={() => {}}
                    className="text-agnos-vermilion focus:ring-agnos-vermilion"
                  />
                  <div>
                    <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                      <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                      Direct to Specific Device
                    </div>
                    <span className="text-[11px] text-zinc-400">Restricted solely to selected device</span>
                  </div>
                </label>
              </div>

              {/* Direct Device Dropdown */}
              {targetMode === 'direct' && (
                <div className="mt-3 p-3 rounded-lg bg-black/40 border border-white/[0.08]">
                  {peerDevices.length === 0 ? (
                    <div className="text-xs text-amber-400 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                      <span>No other devices currently active on the network. Connect your phone or second device first, or use Broadcast!</span>
                    </div>
                  ) : (
                    <div>
                      <label className="text-[11px] font-mono text-zinc-400 block mb-1.5">
                        Select Recipient Device:
                      </label>
                      <select
                        value={selectedTargetDevice}
                        onChange={(e) => setSelectedTargetDevice(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-black/60 border border-white/[0.1] text-xs text-white focus:outline-none focus:border-agnos-vermilion"
                      >
                        {peerDevices.map((dev) => (
                          <option key={dev.device_id} value={dev.device_id}>
                            {dev.device_name} ({dev.client_ip}) — {dev.device_type}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Cryptographic Parameters Confirmation */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
              <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                <div className="text-zinc-500 text-[10px]">Cipher Suite</div>
                <div className="text-white font-medium mt-0.5">AES-256-GCM</div>
              </div>
              <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                <div className="text-zinc-500 text-[10px]">Key Establishment</div>
                <div className="text-white font-medium mt-0.5">X25519 + HKDF</div>
              </div>
              <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                <div className="text-zinc-500 text-[10px]">Framing Header</div>
                <div className="text-white font-medium mt-0.5">Magic ATP1 (4B)</div>
              </div>
            </div>

            {/* Resumable Transfer Simulation Toggle */}
            <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-semibold text-white">Simulate Connection Drop (Test Resume)</span>
                </div>
                <input
                  type="checkbox"
                  checked={simulateDrop}
                  onChange={(e) => setSimulateDrop(e.target.checked)}
                  className="rounded text-agnos-vermilion focus:ring-agnos-vermilion w-4 h-4"
                />
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Interrupts the socket connection after sending a specified chunk number to test persistent checkpoint storage and client resumption.
              </p>

              {simulateDrop && (
                <div className="mt-3 flex items-center gap-3 text-xs font-mono">
                  <span className="text-zinc-300">Drop after chunk #:</span>
                  <input
                    type="number"
                    min="1"
                    max={Math.max(1, calculateChunks(file.size) - 1)}
                    value={dropAfterChunks}
                    onChange={(e) => setDropAfterChunks(parseInt(e.target.value) || 1)}
                    className="w-20 px-2 py-1 rounded bg-black/60 border border-white/[0.1] text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
              )}
            </div>

            {/* Action Button */}
            {!completed ? (
              <button
                disabled={uploading || (targetMode === 'direct' && peerDevices.length === 0)}
                onClick={handleStartTransfer}
                className="w-full py-3.5 rounded-full text-sm font-semibold bg-agnos-vermilion text-white hover:bg-agnos-vermilion-hover disabled:opacity-50 shadow-lg shadow-agnos-vermilion/20 flex items-center justify-center gap-2 transition-all"
              >
                {uploading ? (
                  <>
                    <RotateCw className="w-4 h-4 animate-spin" />
                    <span>Transmitting over TCP Engine...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    <span>Start Encrypted TCP Transfer</span>
                  </>
                )}
              </button>
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <button
                  onClick={() => navigate('/app/received')}
                  className="w-full sm:flex-1 py-3 rounded-full text-sm font-semibold bg-emerald-500 text-white hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>View in Received Vault</span>
                </button>
                <button
                  onClick={() => {
                    setFile(null);
                    setCompleted(false);
                    setProgress(0);
                    setStatusMessage('');
                  }}
                  className="w-full sm:w-auto px-6 py-3 rounded-full text-xs font-medium text-zinc-300 hover:text-white bg-white/[0.05] border border-white/[0.08]"
                >
                  Send Another
                </button>
              </div>
            )}

            {/* Live Progress feedback */}
            {statusMessage && (
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-zinc-300">{statusMessage}</span>
                  <span className="text-agnos-vermilion font-bold">{progress}%</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-agnos-vermilion transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400">
                {error}
              </div>
            )}
          </div>
        )}

        {/* Visualizer */}
        <ProtocolVisualizer />
      </div>
    </AppShell>
  );
};

import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { X, Smartphone, Copy, Check, Wifi, ExternalLink, RefreshCw } from 'lucide-react';
import { api } from '../services/api';
import { NetworkInfo } from '../types';

interface NetworkQrModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NetworkQrModal: React.FC<NetworkQrModalProps> = ({ isOpen, onClose }) => {
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchNetwork = async () => {
    setLoading(true);
    try {
      const info = await api.getNetworkInfo();
      setNetworkInfo(info);
      const targetUrl = info.network_url || `http://${window.location.hostname}:8000`;
      const url = await QRCode.toDataURL(targetUrl, {
        width: 260,
        margin: 1,
        color: {
          dark: '#060612',
          light: '#ffffff',
        },
      });
      setQrDataUrl(url);
    } catch {
      const fallbackUrl = `${window.location.protocol}//${window.location.host}`;
      setNetworkInfo({
        local_ip: window.location.hostname,
        http_host: '0.0.0.0',
        http_port: Number(window.location.port) || 8000,
        tcp_host: '0.0.0.0',
        tcp_port: 9000,
        network_url: fallbackUrl,
        local_url: `http://localhost:${window.location.port || 8000}`,
      });
      try {
        const url = await QRCode.toDataURL(fallbackUrl, {
          width: 260,
          margin: 1,
          color: { dark: '#060612', light: '#ffffff' },
        });
        setQrDataUrl(url);
      } catch {
        // ignore
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchNetwork();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const effectiveUrl = networkInfo?.network_url || `${window.location.protocol}//${window.location.host}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(effectiveUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-agnos-dark border border-white/[0.1] rounded-2xl p-6 shadow-2xl shadow-black/80 text-center">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-white/[0.08] transition-colors"
          title="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Title */}
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-agnos-vermilion/20 border border-agnos-vermilion/40 flex items-center justify-center text-agnos-vermilion">
            <Smartphone className="w-4 h-4" />
          </div>
          <h2 className="text-lg font-bold text-white tracking-tight">Connect Another Device</h2>
        </div>
        <p className="text-xs text-zinc-400 mb-6">
          Scan the QR code to open the ATP dashboard on your mobile phone or laptop.
        </p>

        {/* White QR Code Canvas Card */}
        <div className="mx-auto inline-block p-3.5 bg-white rounded-2xl shadow-xl border border-white/20 transition-transform hover:scale-105">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt="Network access QR code"
              className="w-52 h-52 rounded-xl"
            />
          ) : (
            <div className="w-52 h-52 flex items-center justify-center text-zinc-400 text-xs">
              Generating QR...
            </div>
          )}
        </div>

        {/* Address in Text Right Under QR */}
        <div className="mt-5 flex flex-col items-center">
          <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 flex items-center gap-1.5 mb-1.5">
            <Wifi className="w-3.5 h-3.5 text-agnos-vermilion" />
            Local Network Address
          </span>

          <div className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.1] hover:border-agnos-vermilion/40 transition-colors">
            <span className="text-xs sm:text-sm font-mono font-bold text-agnos-vermilion tracking-tight truncate select-all">
              {effectiveUrl}
            </span>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-white/[0.08] hover:bg-agnos-vermilion text-white transition-colors"
                title="Copy Address"
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy</span>
                  </>
                )}
              </button>

              <a
                href={effectiveUrl}
                target="_blank"
                rel="noreferrer"
                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors"
                title="Open in new tab"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          <p className="text-[11px] text-zinc-500 mt-3 max-w-xs leading-relaxed">
            Ensure both devices are on the same Wi-Fi or Local Area Network (LAN). TCP Engine listens on port {networkInfo?.tcp_port || 9000}.
          </p>
        </div>

        <div className="mt-6 pt-4 border-t border-white/[0.08] flex items-center justify-between">
          <button
            onClick={fetchNetwork}
            className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh IP
          </button>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-full text-xs font-semibold bg-white/[0.08] hover:bg-white/[0.15] text-zinc-200 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

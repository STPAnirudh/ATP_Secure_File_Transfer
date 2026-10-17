import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Smartphone, Copy, Check, Wifi, ExternalLink, RefreshCw } from 'lucide-react';
import { api } from '../services/api';
import { NetworkInfo } from '../types';

interface NetworkQrCardProps {
  className?: string;
  compact?: boolean;
}

export const NetworkQrCard: React.FC<NetworkQrCardProps> = ({ className = '', compact = false }) => {
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
        width: compact ? 180 : 240,
        margin: 1,
        color: {
          dark: '#060612',
          light: '#ffffff',
        },
      });
      setQrDataUrl(url);
    } catch {
      // Fallback to window.location if API fails
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
          width: compact ? 180 : 240,
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
    fetchNetwork();
  }, [compact]);

  const effectiveUrl = networkInfo?.network_url || `${window.location.protocol}//${window.location.host}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(effectiveUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className={`agnos-card relative overflow-hidden border border-white/[0.08] bg-agnos-card/90 backdrop-blur-xl ${className}`}>
      {/* Subtle background glow */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-agnos-vermilion/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-agnos-vermilion/15 border border-agnos-vermilion/30 flex items-center justify-center text-agnos-vermilion">
            <Smartphone className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              Cross-Device Access
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </h3>
            <p className="text-xs text-zinc-400">Scan to open on phone, tablet, or laptop</p>
          </div>
        </div>

        <button
          onClick={fetchNetwork}
          title="Refresh Network Address"
          className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* QR Code and Address Container */}
      <div className="pt-5 flex flex-col items-center text-center">
        {/* QR Code Canvas */}
        <div className="p-3 bg-white rounded-2xl shadow-2xl shadow-black/60 border border-white/10 flex items-center justify-center transition-transform hover:scale-[1.02]">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt="Scan QR code to access ATP on local network"
              className={compact ? 'w-36 h-36 rounded-lg' : 'w-48 h-48 rounded-lg'}
            />
          ) : (
            <div className={`${compact ? 'w-36 h-36' : 'w-48 h-48'} flex items-center justify-center text-zinc-400 text-xs`}>
              Generating QR...
            </div>
          )}
        </div>

        {/* Address in text right under QR */}
        <div className="mt-4 w-full flex flex-col items-center">
          <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 flex items-center gap-1.5 mb-1.5">
            <Wifi className="w-3 h-3 text-agnos-vermilion" />
            Network Access Address
          </span>

          {/* Interactive URL Pill */}
          <div className="w-full max-w-sm flex items-center justify-between gap-2 px-3.5 py-2 rounded-xl bg-white/[0.04] border border-white/[0.1] hover:border-agnos-vermilion/40 transition-colors group">
            <span className="text-xs sm:text-sm font-mono font-semibold text-white tracking-tight truncate select-all">
              {effectiveUrl}
            </span>

            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-white/[0.08] hover:bg-agnos-vermilion hover:text-white text-zinc-200 transition-colors"
                title="Copy address to clipboard"
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
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          {/* Wi-Fi note */}
          <p className="text-[11px] text-zinc-400 mt-2.5 max-w-xs leading-relaxed">
            Ensure devices are connected to the same Wi-Fi network. Point your camera at the QR code to open the dashboard instantly.
          </p>
        </div>
      </div>
    </div>
  );
};

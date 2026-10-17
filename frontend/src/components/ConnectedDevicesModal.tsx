import React, { useState } from 'react';
import { X, Smartphone, Monitor, Tablet, Edit3, Check, Wifi, QrCode } from 'lucide-react';
import { useDevice } from '../context/DeviceContext';
import { formatTime } from '../utils/date';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onOpenQr: () => void;
}

export const ConnectedDevicesModal: React.FC<Props> = ({ isOpen, onClose, onOpenQr }) => {
  const { deviceId, deviceName, renameDevice, connectedDevices } = useDevice();
  const [editing, setEditing] = useState(false);
  const [newName, setNewName] = useState(deviceName);
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleSaveRename = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await renameDevice(newName.trim());
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const getDeviceIcon = (type?: string) => {
    if (type === 'mobile') return <Smartphone className="w-5 h-5 text-agnos-vermilion" />;
    if (type === 'tablet') return <Tablet className="w-5 h-5 text-cyan-400" />;
    return <Monitor className="w-5 h-5 text-emerald-400" />;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg agnos-card p-6 sm:p-8 overflow-hidden shadow-2xl border border-white/[0.1]">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1 rounded-full text-zinc-400 hover:text-white hover:bg-white/[0.1] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-2">
          <span className="agnos-badge">
            <Wifi className="w-3 h-3 text-agnos-vermilion" />
            NETWORK PRESENCE
          </span>
        </div>

        <h2 className="text-xl font-bold text-white mb-1">
          Connected Devices
        </h2>
        <p className="text-xs text-zinc-400 mb-6">
          Devices active on this Wi-Fi node. Choose how you appear and select targets for direct transfer.
        </p>

        {/* Current Device Box */}
        <div className="p-4 rounded-xl bg-agnos-vermilion/5 border border-agnos-vermilion/20 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-mono uppercase tracking-wider text-agnos-vermilion font-semibold">
              Your Current Device
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
              Online (Active)
            </span>
          </div>

          {!editing ? (
            <div className="flex items-center justify-between mt-1">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-agnos-vermilion/10 flex items-center justify-center">
                  <Smartphone className="w-4 h-4 text-agnos-vermilion" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">{deviceName}</h4>
                  <span className="text-[11px] font-mono text-zinc-500">ID: {deviceId.slice(0, 12)}...</span>
                </div>
              </div>
              <button
                onClick={() => {
                  setNewName(deviceName);
                  setEditing(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium text-zinc-300 hover:text-white bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.1] transition-all"
              >
                <Edit3 className="w-3 h-3" />
                Rename
              </button>
            </div>
          ) : (
            <div className="mt-2 flex items-center gap-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Enter custom device name..."
                className="flex-1 px-3 py-1.5 rounded-lg bg-black/60 border border-agnos-vermilion/40 text-xs text-white focus:outline-none focus:border-agnos-vermilion"
                autoFocus
              />
              <button
                disabled={saving}
                onClick={handleSaveRename}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-agnos-vermilion text-white hover:bg-agnos-vermilion-hover transition-colors flex items-center gap-1"
              >
                <Check className="w-3.5 h-3.5" />
                Save
              </button>
              <button
                onClick={() => setEditing(false)}
                className="px-2.5 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {/* Other Active Devices List */}
        <div className="space-y-2 mb-6 max-h-56 overflow-y-auto pr-1">
          <div className="text-xs font-semibold text-zinc-400 mb-2">
            Active Devices On Wi-Fi ({connectedDevices.length || 1})
          </div>

          {connectedDevices.length === 0 ? (
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] text-center text-xs text-zinc-400">
              Only this device is currently connected. Scan the QR code from your phone or other device to join!
            </div>
          ) : (
            connectedDevices.map((dev) => {
              const isSelf = dev.device_id === deviceId;
              return (
                <div
                  key={dev.device_id}
                  className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                    isSelf
                      ? 'bg-white/[0.04] border-white/[0.12]'
                      : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
                      {getDeviceIcon(dev.device_type)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-white">
                          {isSelf ? deviceName : dev.device_name}
                        </span>
                        {isSelf && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-agnos-vermilion/20 text-agnos-vermilion font-mono">
                            You
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] font-mono text-zinc-500 mt-0.5">
                        {dev.client_ip} • Active {formatTime(dev.last_seen)}
                      </div>
                    </div>
                  </div>

                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                </div>
              );
            })
          )}
        </div>

        {/* Footer CTA */}
        <div className="flex items-center justify-between pt-4 border-t border-white/[0.08]">
          <button
            onClick={() => {
              onClose();
              onOpenQr();
            }}
            className="inline-flex items-center gap-1.5 text-xs text-agnos-vermilion hover:underline"
          >
            <QrCode className="w-3.5 h-3.5" />
            Show QR Code to Connect Another Device
          </button>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-full text-xs font-medium bg-white/[0.08] hover:bg-white/[0.15] text-white transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

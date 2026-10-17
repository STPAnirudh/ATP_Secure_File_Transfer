import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { ConnectedDevice } from '../types';
import { api } from '../services/api';

interface DeviceContextType {
  deviceId: string;
  deviceName: string;
  deviceType: 'desktop' | 'mobile' | 'tablet';
  connectedDevices: ConnectedDevice[];
  renameDevice: (newName: string) => Promise<void>;
  refreshDevices: () => Promise<void>;
}

const DeviceContext = createContext<DeviceContextType | undefined>(undefined);

function detectDeviceType(): 'desktop' | 'mobile' | 'tablet' {
  const ua = navigator.userAgent.toLowerCase();
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    return 'tablet';
  }
  if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated/i.test(ua)) {
    return 'mobile';
  }
  return 'desktop';
}

function getDefaultDeviceName(type: 'desktop' | 'mobile' | 'tablet'): string {
  const ua = navigator.userAgent;
  let os = 'Device';
  if (/iPhone/i.test(ua)) os = 'iPhone';
  else if (/iPad/i.test(ua)) os = 'iPad';
  else if (/Android/i.test(ua)) os = 'Android Phone';
  else if (/Windows/i.test(ua)) os = 'Windows PC';
  else if (/Macintosh|Mac OS X/i.test(ua)) os = 'MacBook';
  else if (/Linux/i.test(ua)) os = 'Linux Station';

  const randomSuffix = Math.floor(100 + Math.random() * 900);
  return `${os} #${randomSuffix}`;
}

export const DeviceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [deviceId] = useState<string>(() => {
    let id = localStorage.getItem('atp_device_id');
    if (!id) {
      id = 'dev_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36).substring(4);
      localStorage.setItem('atp_device_id', id);
    }
    return id;
  });

  const [deviceType] = useState<'desktop' | 'mobile' | 'tablet'>(() => detectDeviceType());

  const [deviceName, setDeviceNameState] = useState<string>(() => {
    const saved = localStorage.getItem('atp_device_name');
    if (saved && saved.trim()) return saved.trim();
    const generated = getDefaultDeviceName(detectDeviceType());
    localStorage.setItem('atp_device_name', generated);
    return generated;
  });

  const [connectedDevices, setConnectedDevices] = useState<ConnectedDevice[]>([]);

  const sendPresenceHeartbeat = useCallback(async () => {
    try {
      await api.sendHeartbeat({
        device_id: deviceId,
        device_name: deviceName,
        device_type: deviceType,
      });
    } catch (err) {
      // Ignore heartbeat network drops
    }
  }, [deviceId, deviceName, deviceType]);

  const refreshDevices = useCallback(async () => {
    try {
      const list = await api.getDevices();
      setConnectedDevices(list);
    } catch {
      // Ignore
    }
  }, []);

  // Heartbeat & device list polling
  useEffect(() => {
    sendPresenceHeartbeat();
    refreshDevices();

    const heartbeatInterval = setInterval(() => {
      sendPresenceHeartbeat();
    }, 20000);

    const refreshInterval = setInterval(() => {
      refreshDevices();
    }, 10000);

    return () => {
      clearInterval(heartbeatInterval);
      clearInterval(refreshInterval);
    };
  }, [sendPresenceHeartbeat, refreshDevices]);

  const renameDevice = async (newName: string) => {
    const clean = newName.trim();
    if (!clean) return;

    setDeviceNameState(clean);
    localStorage.setItem('atp_device_name', clean);

    try {
      await api.renameDevice({ device_id: deviceId, new_name: clean });
      await sendPresenceHeartbeat();
      await refreshDevices();
    } catch (err) {
      console.error('Failed to sync device rename:', err);
    }
  };

  return (
    <DeviceContext.Provider
      value={{
        deviceId,
        deviceName,
        deviceType,
        connectedDevices,
        renameDevice,
        refreshDevices,
      }}
    >
      {children}
    </DeviceContext.Provider>
  );
};

export const useDevice = (): DeviceContextType => {
  const context = useContext(DeviceContext);
  if (!context) {
    throw new Error('useDevice must be used within a DeviceProvider');
  }
  return context;
};

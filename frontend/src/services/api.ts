import {
  ServerHealth,
  Transfer,
  TransferDetail,
  ActivityLog,
  SecurityStatus,
  ReceivedFile,
  NetworkInfo,
  ConnectedDevice,
} from '../types';

const API_BASE = '/api';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const errorText = await res.text();
    let message = `Request failed with status ${res.status}`;
    try {
      const parsed = JSON.parse(errorText);
      if (parsed.detail) message = parsed.detail;
    } catch {
      if (errorText) message = errorText;
    }
    throw new Error(message);
  }

  return res.json();
}

export const api = {
  // Health & Overview
  getHealth: () => fetchJson<ServerHealth>('/health'),
  getNetworkInfo: () => fetchJson<NetworkInfo>('/network-info'),

  // Devices & Presence
  getDevices: () => fetchJson<ConnectedDevice[]>('/devices'),
  sendHeartbeat: (data: { device_id: string; device_name: string; device_type?: string }) =>
    fetchJson<{ status: string; device_id: string; device_name: string }>('/devices/heartbeat', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  renameDevice: (data: { device_id: string; new_name: string }) =>
    fetchJson<{ status: string; device_id: string; new_name: string }>('/devices/rename', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Transfers
  getTransfers: (status?: string, deviceId?: string) => {
    const params = new URLSearchParams();
    if (status && status !== 'all') params.append('status', status);
    if (deviceId) params.append('device_id', deviceId);
    const queryString = params.toString() ? `?${params.toString()}` : '';
    return fetchJson<Transfer[]>(`/transfers${queryString}`);
  },

  getTransfer: (id: string) => fetchJson<TransferDetail>(`/transfers/${id}`),

  deleteTransfer: (id: string) =>
    fetchJson<{ status: string; message: string }>(`/transfers/${id}`, {
      method: 'DELETE',
    }),

  clearAllTransfers: () =>
    fetchJson<{ status: string; message: string }>('/transfers', {
      method: 'DELETE',
    }),

  resumeTransfer: (id: string) =>
    fetchJson<{ message: string; transfer: Transfer }>(`/transfers/${id}/resume`, {
      method: 'POST',
    }),

  retryTransfer: (id: string) =>
    fetchJson<{ message: string; transfer: Transfer }>(`/transfers/${id}/retry`, {
      method: 'POST',
    }),

  initiateTransfer: (formData: FormData) =>
    fetch(`${API_BASE}/transfers/send-client`, {
      method: 'POST',
      body: formData,
    }).then(async (res) => {
      if (!res.ok) {
        const errorText = await res.text();
        let message = `Transfer failed (${res.status})`;
        try {
          const parsed = JSON.parse(errorText);
          if (parsed.detail) message = parsed.detail;
        } catch {
          if (errorText) message = errorText;
        }
        throw new Error(message);
      }
      return res.json();
    }),

  // Files
  getReceivedFiles: (deviceId?: string) => {
    const query = deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : '';
    return fetchJson<ReceivedFile[]>(`/files${query}`);
  },

  deleteReceivedFile: (filename: string) =>
    fetchJson<{ status: string; message: string }>(`/files/${encodeURIComponent(filename)}`, {
      method: 'DELETE',
    }),

  clearAllReceivedFiles: () =>
    fetchJson<{ status: string; message: string }>('/files', {
      method: 'DELETE',
    }),

  getFileDownloadUrl: (fileName: string) =>
    `${API_BASE}/files/${encodeURIComponent(fileName)}/download`,

  // Activity Audit
  getActivity: (limit = 50) => fetchJson<ActivityLog[]>(`/activity?limit=${limit}`),
  clearActivity: () =>
    fetchJson<{ status: string; message: string }>('/activity', {
      method: 'DELETE',
    }),

  // Security Status
  getSecurityStatus: () => fetchJson<SecurityStatus>('/security/status'),

  // Settings
  getSettings: () => fetchJson<Record<string, unknown>>('/settings'),

  updateSettings: (settings: Record<string, unknown>) =>
    fetchJson<Record<string, unknown>>('/settings', {
      method: 'POST',
      body: JSON.stringify(settings),
    }),
};

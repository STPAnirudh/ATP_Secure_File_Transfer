import {
  ServerHealth,
  Transfer,
  TransferDetail,
  ActivityLog,
  SecurityStatus,
  ReceivedFile,
  NetworkInfo,
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

  // Transfers
  getTransfers: (status?: string) => {
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    return fetchJson<Transfer[]>(`/transfers${query}`);
  },

  getTransfer: (id: string) => fetchJson<TransferDetail>(`/transfers/${id}`),

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
  getReceivedFiles: () => fetchJson<ReceivedFile[]>('/files'),

  getFileDownloadUrl: (fileName: string) =>
    `${API_BASE}/files/${encodeURIComponent(fileName)}/download`,

  // Activity Audit
  getActivity: (limit = 50) => fetchJson<ActivityLog[]>(`/activity?limit=${limit}`),

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

export type TransferStatus = 'pending' | 'in_progress' | 'interrupted' | 'completed' | 'failed';
export type TransferDirection = 'upload' | 'download';

export interface Transfer {
  id: string;
  file_name: string;
  file_size: number;
  total_chunks: number;
  transferred_bytes: number;
  completed_chunks: number;
  sha256_hash: string;
  status: TransferStatus;
  direction: TransferDirection;
  client_ip?: string;
  session_key_fingerprint?: string;
  error_message?: string;
  target_device_id?: string;
  sender_device_id?: string;
  created_at: string;
  updated_at: string;
}

export interface TransferChunk {
  transfer_id: string;
  chunk_index: number;
  byte_offset: number;
  chunk_size: number;
  sha256_chunk?: string;
  status: string;
  created_at: string;
}

export interface TransferDetail extends Transfer {
  chunks: TransferChunk[];
}

export interface ActivityLog {
  id: number;
  transfer_id?: string;
  event_type: string;
  details: string;
  severity: 'info' | 'warning' | 'error' | 'success';
  timestamp: string;
}

export interface SecurityAuditItem {
  id: number;
  event: string;
  client_id?: string;
  cipher_suite: string;
  key_exchange: string;
  status: string;
  details: string;
  timestamp: string;
}

export interface SecurityStatus {
  cipher_suite: string;
  key_exchange: string;
  nonce_length_bytes: number;
  tag_length_bytes: number;
  sha256_integrity_enforced: boolean;
  resumable_verification_enforced: boolean;
  active_sessions_count: number;
  total_authenticated_chunks: number;
  audit_logs: SecurityAuditItem[];
}

export interface ReceivedFile {
  name: string;
  size: number;
  transfer_id: string;
  sha256_hash: string;
  target_device_id?: string;
  sender_device_id?: string;
  verified: boolean;
  received_at: string;
}

export interface ConnectedDevice {
  device_id: string;
  device_name: string;
  device_type: 'desktop' | 'mobile' | 'tablet';
  client_ip: string;
  last_seen: string;
}

export interface ServerHealth {
  status: string;
  version: string;
  uptime_seconds: number;
  tcp_port: number;
  tcp_active_connections: number;
  active_devices_count?: number;
  active_transfers_count: number;
  completed_transfers_count: number;
  interrupted_transfers_count: number;
  total_bytes_transferred: number;
  database_status: string;
  local_ip?: string;
  network_url?: string;
}

export interface NetworkInfo {
  local_ip: string;
  http_host: string;
  http_port: number;
  tcp_host: string;
  tcp_port: number;
  network_url: string;
  local_url: string;
}

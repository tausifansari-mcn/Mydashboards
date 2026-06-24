export interface User {
  id: number;
  name: string;
  email: string;
  role: 'super_admin' | 'client_admin' | 'manager' | 'qa';
  roleDisplay: string;
  clientId: number | null;
  clientName: string | null;
  lastLogin?: string;
}

export interface Client {
  id: number;
  name: string;
  dialdesk_client_id: number;
  logo_url?: string;
  is_active: boolean;
  created_at: string;
  _count?: { users: number; processes: number };
}

export interface Process {
  id: number;
  client_id: number;
  process_name: string;
  lob: 'Inbound' | 'Outbound' | 'IB/OB';
  dialdesk_client_id: number;
  is_active: boolean;
  client?: { id: number; name: string };
}

export interface Dashboard {
  id: number;
  name: string;
  slug: string;
  icon: string;
  description?: string;
  is_active: boolean;
  sort_order: number;
  can_export?: boolean;
}

export interface AuditLog {
  id: number;
  user_id: number;
  action: string;
  entity_type?: string;
  entity_id?: number;
  old_values?: Record<string, unknown>;
  new_values?: Record<string, unknown>;
  created_at: string;
  user: { id: number; name: string; email: string };
}

export interface LoginLog {
  id: number;
  user_id: number;
  ip_address: string;
  user_agent?: string;
  status: 'success' | 'failed';
  logged_at: string;
  user: { id: number; name: string; email: string };
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

import { create } from 'zustand';

export interface ProcessItem {
  id: number;
  process_name: string;
  lob: string;
  dialdesk_client_id: number;
  client_id: number;
  is_active: boolean;
}

// Maps inbound route slug → dialdesk_client_id (from seed.ts)
export const INBOUND_SLUG_TO_CLIENT_ID: Record<string, number> = {
  gnc:          409,
  bellavita:    375,
  clovia:       468,
  neemans:      475,
  viega:        352,
  exicom:       326,
  dubangladesh: 380,
};

interface ProcessStore {
  processes: ProcessItem[];
  loaded: boolean;
  isSuperAdmin: boolean;
  setProcesses: (p: ProcessItem[], isSuperAdmin: boolean) => void;
  reset: () => void;
  // Returns true if the user can access a given dialdesk_client_id for Inbound
  canAccessInboundClient: (clientId: number | string) => boolean;
  // Returns true if the user can access a given dialdesk_client_id for Outbound
  canAccessOutboundClient: (clientId: number | string) => boolean;
  // Returns true if the user can access an inbound project by slug key
  canAccessInboundSlug: (slug: string) => boolean;
}

export const useProcessStore = create<ProcessStore>((set, get) => ({
  processes: [],
  loaded: false,
  isSuperAdmin: false,

  setProcesses: (processes, isSuperAdmin) => set({ processes, loaded: true, isSuperAdmin }),

  reset: () => set({ processes: [], loaded: false, isSuperAdmin: false }),

  canAccessInboundClient: (clientId) => {
    const { isSuperAdmin, processes, loaded } = get();
    if (isSuperAdmin || !loaded) return true;
    const id = Number(clientId);
    return processes.some(
      (p) => p.dialdesk_client_id === id && (p.lob === 'Inbound' || p.lob === 'IB/OB'),
    );
  },

  canAccessOutboundClient: (clientId) => {
    const { isSuperAdmin, processes, loaded } = get();
    if (isSuperAdmin || !loaded) return true;
    const id = Number(clientId);
    return processes.some(
      (p) => p.dialdesk_client_id === id && (p.lob === 'Outbound' || p.lob === 'IB/OB'),
    );
  },

  canAccessInboundSlug: (slug) => {
    const { isSuperAdmin, processes, loaded } = get();
    if (isSuperAdmin || !loaded) return true;
    const clientId = INBOUND_SLUG_TO_CLIENT_ID[slug];
    if (!clientId) return false;
    return processes.some(
      (p) => p.dialdesk_client_id === clientId && (p.lob === 'Inbound' || p.lob === 'IB/OB'),
    );
  },
}));

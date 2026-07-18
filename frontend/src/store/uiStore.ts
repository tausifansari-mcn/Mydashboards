import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UIState {
  sidebarExpanded: boolean;
  toggleSidebar: () => void;
  setSidebar: (val: boolean) => void;
  mobileOpen: boolean;
  toggleMobile: () => void;
  closeMobile: () => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarExpanded: true,
      toggleSidebar: () => set((s) => ({ sidebarExpanded: !s.sidebarExpanded })),
      setSidebar: (val) => set({ sidebarExpanded: val }),
      mobileOpen: false,
      toggleMobile: () => set((s) => ({ mobileOpen: !s.mobileOpen })),
      closeMobile: () => set({ mobileOpen: false }),
    }),
    {
      name: 'md-ui',
      partialize: (state) => ({ sidebarExpanded: state.sidebarExpanded }),
    }
  )
);

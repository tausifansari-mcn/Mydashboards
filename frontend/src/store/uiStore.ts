import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UIState {
  sidebarExpanded: boolean;
  toggleSidebar: () => void;
  setSidebar: (val: boolean) => void;
  mobileOpen: boolean;
  toggleMobile: () => void;
  closeMobile: () => void;
  // Which top-level tab (0 = Inbound, 1 = Outbound) the AI Quality landing page was last on. Kept
  // here rather than as local component state because that page unmounts/remounts every time the
  // user opens a specific process and comes back (a separate route, /quality/:clientId) — local
  // state would reset to its default on every remount, which is exactly the "always jumps back to
  // Inbound" bug this fixes.
  aiQualityActiveSlide: number;
  setAiQualityActiveSlide: (slide: number) => void;
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
      aiQualityActiveSlide: 0,
      setAiQualityActiveSlide: (slide) => set({ aiQualityActiveSlide: slide }),
    }),
    {
      name: 'md-ui',
      partialize: (state) => ({ sidebarExpanded: state.sidebarExpanded, aiQualityActiveSlide: state.aiQualityActiveSlide }),
    }
  )
);

import { create } from 'zustand'

interface LandingState {
  visible: boolean
  show: () => void
  hide: () => void
}

/** Session only, not persisted: a reload or a logo click should always bring the splash back. */
export const useLanding = create<LandingState>()((set) => ({
  visible: false,
  show: () => set({ visible: true }),
  hide: () => set({ visible: false }),
}))

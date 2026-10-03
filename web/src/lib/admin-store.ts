import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AdminPrefs {
  /** Edges scored below this need review before they show. Inert until edges carry scores. */
  confidenceThreshold: number
  setConfidenceThreshold: (v: number) => void
}

export const useAdminPrefs = create<AdminPrefs>()(
  persist(
    (set) => ({
      confidenceThreshold: 0.6,
      setConfidenceThreshold: (v) => set({ confidenceThreshold: v }),
    }),
    // Rehydrated after mount so server and first client render agree.
    { name: 'pathnet.admin.v1', skipHydration: true },
  ),
)

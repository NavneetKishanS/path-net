import { create } from 'zustand'
import type { ChatAnswer } from '@/lib/chat/answer'

type NewMessage =
  { from: 'user'; text: string } | { from: 'atlas'; answer: ChatAnswer } | { from: 'atlas'; error: string }
export type ChatMessage = NewMessage & { id: number }

interface ChatState {
  revision: number
  open: boolean
  draft: string
  pending: boolean
  messages: ChatMessage[]
  setOpen: (open: boolean) => void
  setDraft: (draft: string) => void
  setPending: (pending: boolean) => void
  push: (m: NewMessage) => void
  clear: () => void
}

let nextId = 1

/** Session only: the conversation is not stored anywhere. */
export const useChat = create<ChatState>()((set) => ({
  revision: 0,
  open: false,
  draft: '',
  pending: false,
  messages: [],
  setOpen: (open) => set({ open }),
  setDraft: (draft) => set({ draft }),
  setPending: (pending) => set({ pending }),
  push: (m) => set((s) => ({ messages: [...s.messages, { ...m, id: nextId++ }] })),
  clear: () => set((s) => ({ messages: [], draft: '', pending: false, revision: s.revision + 1 })),
}))

'use client'

import { useEffect, useMemo, useRef, type FormEvent, type KeyboardEvent } from 'react'
import { useParams, usePathname, useSearchParams } from 'next/navigation'
import { Dialog } from 'radix-ui'
import { ArrowUp, MessageSquare, X } from 'lucide-react'
import { getApiClient } from '@/api'
import { useRole } from '@/components/role/role-provider'
import { Button } from '@/components/ui/button'
import { answerQuestion } from '@/lib/chat/answer'
import { suggestedQuestions } from '@/lib/chat/suggestions'
import { useGraph } from '@/lib/queries'
import { cn } from '@/lib/cn'
import { useChat } from './chat-store'
import { ChatAnswerView } from './chat-answer'

export const CHAT_WIDTH = 'lg:pr-[420px]'

/** The condition, gene or mechanism on screen, so "it" and the suggestions refer to it. */
function useChatFocus(): string | null {
  const path = usePathname()
  const params = useParams<{ id?: string }>()
  const search = useSearchParams()
  if (/^\/(disease|action|node)\//.test(path) && params.id) return decodeURIComponent(params.id)
  if (path === '/route') return search.get('from')
  if (path === '/') return search.get('focus')
  return null
}

/** "Ask the atlas": header button plus a right-hand sidebar. Non-modal, so the page stays usable beside it. */
export function ChatDock() {
  const { config } = useRole()
  const { open, setOpen } = useChat()
  if (!config.assistant) return null
  return (
    <Dialog.Root open={open} onOpenChange={setOpen} modal={false}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          data-testid="chat-toggle"
          className={cn(
            'inline-flex h-8 items-center gap-1.5 rounded-sm px-2 text-label text-ink-2 hover:bg-surface hover:text-ink',
            open && 'bg-surface text-ink',
          )}
          aria-label="Ask the atlas"
        >
          <MessageSquare className="size-4" aria-hidden />
          <span className="hidden xl:inline">Ask</span>
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <ChatPanel />
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function ChatPanel() {
  const { role, detail } = useRole()
  const { draft, setDraft, pending, setPending, messages, push, clear } = useChat()
  const focusId = useChatFocus()
  const graph = useGraph()
  const input = useRef<HTMLTextAreaElement>(null)
  const end = useRef<HTMLDivElement>(null)

  const suggestions = useMemo(
    () => (graph.data ? suggestedQuestions(role, graph.data, focusId) : []),
    [graph.data, role, focusId],
  )

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' })
  }, [messages.length, pending])

  const fill = (q: string) => {
    setDraft(q)
    requestAnimationFrame(() => {
      const el = input.current
      if (!el) return
      el.focus()
      el.setSelectionRange(q.length, q.length)
    })
  }

  const send = async (e?: FormEvent) => {
    e?.preventDefault()
    const q = draft.trim()
    if (!q || pending) return
    const last = messages.findLast((m) => 'answer' in m && !!m.answer.subjectId)
    const lastSubjectId = last && 'answer' in last ? last.answer.subjectId : null
    push({ from: 'user', text: q })
    setDraft('')
    setPending(true)
    try {
      const answer = await answerQuestion(getApiClient(), q, { focusId, lastSubjectId, detail })
      push({ from: 'atlas', answer })
    } catch {
      push({ from: 'atlas', error: 'The atlas could not answer that. Try again, or rephrase the question.' })
    } finally {
      setPending(false)
    }
  }

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      void send()
    }
  }

  return (
    <Dialog.Content
      data-testid="chat-panel"
      onOpenAutoFocus={(e) => {
        e.preventDefault()
        input.current?.focus()
      }}
      // A sidebar: clicking the page or the evidence drawer must not close it.
      onInteractOutside={(e) => e.preventDefault()}
      className="fixed inset-y-0 right-0 z-30 flex w-full flex-col border-l border-line bg-paper outline-none data-[state=open]:animate-[fade-in_120ms_ease-out] sm:w-[420px]"
    >
      <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <Dialog.Title className="text-h3 text-ink">Ask the atlas</Dialog.Title>
          <Dialog.Description className="mt-1 text-label text-ink-3">
            Answers come only from cited links in this atlas. They are research leads, not medical advice.
          </Dialog.Description>
        </div>
        <div className="-mr-1 flex items-center gap-1">
          {messages.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clear}>
              Clear
            </Button>
          )}
          <Dialog.Close className="rounded-sm p-1 text-ink-3 hover:bg-surface hover:text-ink" aria-label="Close chat">
            <X className="size-4" aria-hidden />
          </Dialog.Close>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5" aria-live="polite" aria-busy={pending}>
        {messages.length === 0 && (
          <div>
            <p className="text-ui text-ink-2">
              Ask about a condition, gene or mechanism in the atlas. Every answer links to its sources.
            </p>
            <p className="meta-label mt-5 mb-2">Try asking</p>
            <ul className="space-y-2" data-testid="chat-suggestions">
              {suggestions.map((q) => (
                <li key={q}>
                  <button
                    type="button"
                    onClick={() => fill(q)}
                    className="w-full rounded-sm border border-line px-3 py-2 text-left text-ui text-ink hover:border-line-strong hover:bg-surface"
                  >
                    {q}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <ol className="space-y-5">
          {messages.map((m) => (
            <li key={m.id}>
              {m.from === 'user' ? (
                <p
                  className="ml-auto w-fit max-w-[85%] rounded-md bg-surface px-3 py-2 text-ui text-ink"
                  data-testid="chat-question"
                >
                  <span className="sr-only">You asked: </span>
                  {m.text}
                </p>
              ) : 'answer' in m ? (
                <ChatAnswerView answer={m.answer} />
              ) : (
                <p className="text-ui text-contra-ink">{m.error}</p>
              )}
            </li>
          ))}
        </ol>
        {pending && <p className="mt-5 text-label text-ink-3">Searching the atlas…</p>}
        <div ref={end} />
      </div>

      <form onSubmit={send} className="border-t border-line px-5 py-3">
        <label htmlFor="chat-input" className="sr-only">
          Your question
        </label>
        <div className="flex items-end gap-2">
          <textarea
            id="chat-input"
            ref={input}
            data-testid="chat-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKey}
            rows={2}
            placeholder="Ask a question"
            className="min-h-[44px] flex-1 resize-none rounded-sm border border-line-strong bg-paper px-3 py-2 text-ui text-ink placeholder:text-ink-3"
          />
          <Button
            type="submit"
            variant="primary"
            className="size-[44px] px-0"
            disabled={!draft.trim() || pending}
            aria-label="Send question"
          >
            <ArrowUp className="size-4" aria-hidden />
          </Button>
        </div>
        <p className="mt-1.5 text-[12px] text-ink-3">Enter to send, Shift + Enter for a new line.</p>
      </form>
    </Dialog.Content>
  )
}

import { createHandlers } from './handlers.ts'

// Kept explicit so core/handler tests run offline in Node as well as Deno.
declare const Deno: { env: { get(name: string): string | undefined }; serve(handler: (request: Request) => Promise<Response>): void }
export function serve(name: 'explain' | 'noRoute' | 'extract') {
  Deno.serve(createHandlers(key => Deno.env.get(key))[name])
}

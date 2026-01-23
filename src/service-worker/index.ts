/// <reference lib="webworker" />

export type { };

declare const self: ServiceWorkerGlobalScope;

let ACCESS_TOKEN: string | null = null;

const AUTH_ENDPOINT = `$/api/Auth/session`;

self.addEventListener('message', (event: ExtendableMessageEvent) => {
  if (event.data?.type === 'SET_ACCESS_TOKEN') {
    ACCESS_TOKEN = event.data.token;
    console.log('[SW] Token updated:', ACCESS_TOKEN ? 'SET' : 'CLEARED');
  }
});
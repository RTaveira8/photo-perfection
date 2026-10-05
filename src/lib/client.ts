import type { CompressResult } from './compress';
import type { Preset } from './presets';

const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
let nextId = 0;
const pending = new Map<number, { resolve: (r: CompressResult) => void; reject: (e: Error) => void }>();

worker.onmessage = (e) => {
  const { id, result, error } = e.data;
  const p = pending.get(id);
  if (!p) return;
  pending.delete(id);
  if (error) p.reject(new Error(error));
  else p.resolve(result);
};

/** Compress in a Web Worker so the page stays responsive. */
export function compressInWorker(file: File, presets: Preset[]): Promise<CompressResult> {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    worker.postMessage({ id, file, presets });
  });
}

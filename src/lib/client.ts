import type { CompressResult } from './compress';
import type { Preset } from './presets';

let worker: Worker | undefined;
let nextId = 0;
const pending = new Map<number, { resolve: (r: CompressResult) => void; reject: (e: Error) => void }>();

// Created on first use, so merely loading the app never fails in a browser without worker support.
function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (e) => {
    const { id, result, error } = e.data;
    const p = pending.get(id);
    if (!p) return;
    pending.delete(id);
    if (error) p.reject(new Error(error));
    else p.resolve(result);
  };
  return worker;
}

/** Compress in a Web Worker so the page stays responsive. */
export function compressInWorker(file: File, presets: Preset[]): Promise<CompressResult> {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    try {
      getWorker().postMessage({ id, file, presets });
    } catch (e) {
      pending.delete(id);
      reject(e as Error);
    }
  });
}

import { compress } from './compress';
import type { Preset } from './presets';

self.onmessage = async (e: MessageEvent<{ id: number; file: File; presets: Preset[] }>) => {
  const { id, file, presets } = e.data;
  try {
    const result = await compress(file, presets);
    self.postMessage({ id, result });
  } catch (err) {
    self.postMessage({ id, error: String(err) });
  }
};

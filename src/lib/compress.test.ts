import { describe, expect, it } from 'vitest';
import { fitLongEdge } from './compress';

describe('fitLongEdge', () => {
  it('scales landscape by width', () => {
    expect(fitLongEdge(6048, 4024, 1440)).toEqual({ width: 1440, height: 958 });
  });
  it('scales portrait by height', () => {
    expect(fitLongEdge(4128, 6192, 1440)).toEqual({ width: 960, height: 1440 });
  });
  it('never upscales', () => {
    expect(fitLongEdge(800, 600, 1440)).toEqual({ width: 800, height: 600 });
  });
});

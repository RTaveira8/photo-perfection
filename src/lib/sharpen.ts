/** Light 3x3 sharpen (identity + amount * laplacian), to offset softness from downscaling. */
export function sharpen(canvas: OffscreenCanvas, amount: number) {
  const { width: w, height: h } = canvas;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.getImageData(0, 0, w, h);
  const src = img.data;
  const out = new Uint8ClampedArray(src);
  const stride = w * 4;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * stride + x * 4;
      for (let c = 0; c < 3; c++) {
        const k = i + c;
        const lap = 4 * src[k] - src[k - 4] - src[k + 4] - src[k - stride] - src[k + stride];
        out[k] = src[k] + amount * lap;
      }
    }
  }
  img.data.set(out);
  ctx.putImageData(img, 0, 0);
}

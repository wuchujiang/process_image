/**
 * 通过采样矩形周边像素的中位数颜色，得到"擦除背景色"。
 * 这样做比直接用纯白填充更自然，对带浅色底纹的文字效果更好。
 */
export function sampleBackgroundColor(
  image: HTMLImageElement,
  rect: { x: number; y: number; width: number; height: number },
  imageW: number,
  imageH: number,
  pad = 6
): string {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth || image.width;
    canvas.height = image.naturalHeight || image.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return "#ffffff";
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    const scaleX = canvas.width / imageW;
    const scaleY = canvas.height / imageH;
    const x = Math.round(rect.x * scaleX);
    const y = Math.round(rect.y * scaleY);
    const w = Math.round(rect.width * scaleX);
    const h = Math.round(rect.height * scaleY);

    const samples: [number, number, number][] = [];

    const pickStrip = (sx: number, sy: number, sw: number, sh: number) => {
      sx = Math.max(0, sx);
      sy = Math.max(0, sy);
      sw = Math.min(canvas.width - sx, sw);
      sh = Math.min(canvas.height - sy, sh);
      if (sw <= 0 || sh <= 0) return;
      const data = ctx.getImageData(sx, sy, sw, sh).data;
      const step = Math.max(1, Math.floor(Math.sqrt((sw * sh) / 200)));
      for (let i = 0; i < data.length; i += 4 * step) {
        samples.push([data[i], data[i + 1], data[i + 2]]);
      }
    };

    pickStrip(x - pad, y - pad, w + 2 * pad, pad); // top
    pickStrip(x - pad, y + h, w + 2 * pad, pad); // bottom
    pickStrip(x - pad, y, pad, h); // left
    pickStrip(x + w, y, pad, h); // right

    if (samples.length === 0) return "#ffffff";

    const median = (arr: number[]) => {
      arr.sort((a, b) => a - b);
      return arr[Math.floor(arr.length / 2)];
    };
    const r = median(samples.map((s) => s[0]));
    const g = median(samples.map((s) => s[1]));
    const b = median(samples.map((s) => s[2]));
    return `rgb(${r}, ${g}, ${b})`;
  } catch {
    return "#ffffff";
  }
}

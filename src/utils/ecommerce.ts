import { removeBackground } from "@imgly/background-removal";

export type ProcessProgress = {
  stage: "removing-bg" | "compositing" | "beautifying" | "done";
  /** 0-1 */
  ratio?: number;
};

export type ProcessOptions = {
  targetSize?: number;
  paddingRatio?: number;
  beautify?: boolean;
  /**
   * 给主体添加柔和的 drop shadow，避免白色/浅色主体边缘与白底融为一体，
   * 同时增加电商主图常见的立体感。默认开启。
   */
  dropShadow?: boolean;
  onProgress?: (p: ProcessProgress) => void;
};

const DEFAULT_TARGET = 800;
const DEFAULT_PADDING = 0.06;
const SHADOW_COLOR = "rgba(0, 0, 0, 0.22)";
const SHADOW_BLUR = 32;
const SHADOW_OFFSET_Y = 12;

/**
 * 主流程：
 *   1. AI 抠图（@imgly/background-removal，纯前端 ONNX）
 *   2. 扫描透明边界，将主体居中放入 800×800 白底
 *   3. 自动美化：轻微提亮 + 微对比 + 微饱和 + Unsharp Mask 锐化
 */
export async function processToWhiteBg(
  file: Blob,
  opts: ProcessOptions = {}
): Promise<string> {
  const target = opts.targetSize ?? DEFAULT_TARGET;
  const paddingRatio = opts.paddingRatio ?? DEFAULT_PADDING;
  const beautify = opts.beautify ?? true;
  const dropShadow = opts.dropShadow ?? true;
  const onProgress = opts.onProgress;

  onProgress?.({ stage: "removing-bg", ratio: 0 });

  const cutoutBlob = await removeBackground(file, {
    output: { format: "image/png", quality: 0.92 },
    progress: (_key, current, total) => {
      if (total > 0) {
        onProgress?.({
          stage: "removing-bg",
          ratio: Math.min(1, current / total),
        });
      }
    },
  });

  onProgress?.({ stage: "compositing" });

  const cutoutImg = await loadBlobAsImage(cutoutBlob);

  const trim = scanAlphaBoundingBox(cutoutImg);
  const cropW = trim.w > 0 ? trim.w : cutoutImg.width;
  const cropH = trim.h > 0 ? trim.h : cutoutImg.height;

  const padding = Math.round(target * paddingRatio);
  const maxW = target - padding * 2;
  const maxH = target - padding * 2;
  const scale = Math.min(maxW / cropW, maxH / cropH);
  const drawW = cropW * scale;
  const drawH = cropH * scale;
  const drawX = (target - drawW) / 2;
  const drawY = (target - drawH) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = target;
  canvas.height = target;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, target, target);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  if (dropShadow) {
    ctx.save();
    ctx.shadowColor = SHADOW_COLOR;
    ctx.shadowBlur = SHADOW_BLUR;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = SHADOW_OFFSET_Y;
    ctx.drawImage(
      cutoutImg,
      trim.x,
      trim.y,
      cropW,
      cropH,
      drawX,
      drawY,
      drawW,
      drawH
    );
    ctx.restore();
  } else {
    ctx.drawImage(
      cutoutImg,
      trim.x,
      trim.y,
      cropW,
      cropH,
      drawX,
      drawY,
      drawW,
      drawH
    );
  }

  if (beautify) {
    onProgress?.({ stage: "beautifying" });
    applyAutoBeautify(canvas);
  }

  onProgress?.({ stage: "done" });
  return canvas.toDataURL("image/png");
}

function loadBlobAsImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

/**
 * 扫描透明像素的最小包围盒，便于居中放置（避免抠图后的大量透明边距）。
 * 返回相对于原图的 (x, y, w, h)。
 */
function scanAlphaBoundingBox(img: HTMLImageElement): {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  const w = img.width;
  const h = img.height;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) return { x: 0, y: 0, w, h };
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, w, h).data;

  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;

  const ALPHA_THRESHOLD = 16;
  for (let y = 0; y < h; y++) {
    const rowBase = y * w * 4;
    for (let x = 0; x < w; x++) {
      const a = data[rowBase + x * 4 + 3];
      if (a > ALPHA_THRESHOLD) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < 0 || maxY < 0) return { x: 0, y: 0, w, h };
  return {
    x: minX,
    y: minY,
    w: maxX - minX + 1,
    h: maxY - minY + 1,
  };
}

/**
 * 自动美化：
 *   - 亮度 +5%、对比 +8%、饱和度 +5%（一次 drawImage filter，性能最佳）
 *   - 然后做一次 Unsharp Mask 锐化（半径 1px，强度 0.5）
 */
function applyAutoBeautify(canvas: HTMLCanvasElement) {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const tmp = document.createElement("canvas");
  tmp.width = w;
  tmp.height = h;
  const tctx = tmp.getContext("2d");
  if (!tctx) return;
  tctx.drawImage(canvas, 0, 0);

  ctx.clearRect(0, 0, w, h);
  ctx.filter = "brightness(105%) contrast(108%) saturate(105%)";
  ctx.drawImage(tmp, 0, 0);
  ctx.filter = "none";

  applyUnsharpMask(canvas, 0.5);
}

/**
 * Unsharp Mask: sharpened = original + amount * (original - blurred)
 */
function applyUnsharpMask(canvas: HTMLCanvasElement, amount: number) {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const blurC = document.createElement("canvas");
  blurC.width = w;
  blurC.height = h;
  const bctx = blurC.getContext("2d");
  if (!bctx) return;
  bctx.filter = "blur(1px)";
  bctx.drawImage(canvas, 0, 0);

  const orig = ctx.getImageData(0, 0, w, h);
  const blurred = bctx.getImageData(0, 0, w, h);
  const od = orig.data;
  const bd = blurred.data;

  for (let i = 0; i < od.length; i += 4) {
    od[i] = clamp255(od[i] + amount * (od[i] - bd[i]));
    od[i + 1] = clamp255(od[i + 1] + amount * (od[i + 1] - bd[i + 1]));
    od[i + 2] = clamp255(od[i + 2] + amount * (od[i + 2] - bd[i + 2]));
  }
  ctx.putImageData(orig, 0, 0);
}

function clamp255(v: number): number {
  if (v < 0) return 0;
  if (v > 255) return 255;
  return v;
}

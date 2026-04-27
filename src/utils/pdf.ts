import * as pdfjsLib from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { PDFDocument } from "pdf-lib";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

export type RenderedPage = {
  pageIndex: number;
  pageCount: number;
  imageDataUrl: string;
  width: number;
  height: number;
};

export async function renderPdfToImages(
  file: File,
  scale = 2
): Promise<RenderedPage[]> {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

  const out: RenderedPage[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvasContext: ctx, viewport }).promise;

    out.push({
      pageIndex: i - 1,
      pageCount: pdf.numPages,
      imageDataUrl: canvas.toDataURL("image/png"),
      width: canvas.width,
      height: canvas.height,
    });
  }
  return out;
}

export async function imagesToPdf(
  imageDataUrls: { dataUrl: string; width: number; height: number }[]
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();

  for (const item of imageDataUrls) {
    const isPng = item.dataUrl.startsWith("data:image/png");
    const bytes = dataUrlToUint8(item.dataUrl);
    const embedded = isPng
      ? await doc.embedPng(bytes)
      : await doc.embedJpg(bytes);

    const page = doc.addPage([item.width, item.height]);
    page.drawImage(embedded, {
      x: 0,
      y: 0,
      width: item.width,
      height: item.height,
    });
  }

  return await doc.save();
}

function dataUrlToUint8(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(",")[1];
  const binary = atob(base64);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
  return arr;
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type Konva from "konva";
import Toolbar from "../components/Toolbar";
import Sidebar from "../components/Sidebar";
import Editor, { type EditorHandle } from "../components/Editor";
import type {
  Annotation,
  EditorMode,
  PageDoc,
  TextStyle,
} from "../types";
import JSZip from "jszip";
import {
  readImageFile,
  stripExtension,
  triggerDownload,
} from "../utils/download";
import { imagesToPdf, renderPdfToImages } from "../utils/pdf";
import dayjs from "dayjs";

const DEFAULT_TEXT_STYLE: TextStyle = {
  text: dayjs().format("YYYY年MM月DD日"),
  fontFamily: "SimSun",
  fontSize: 18,
  fill: "#111827",
  bold: false,
  italic: false,
};

type Props = {
  onLoadingChange?: (loading: boolean) => void;
  onContentChange?: (hasContent: boolean) => void;
};

export default function EditorPage({
  onLoadingChange,
  onContentChange,
}: Props) {
  const [pages, setPages] = useState<PageDoc[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mode, setMode] = useState<EditorMode>("select");
  const [textStyle, setTextStyle] = useState<TextStyle>(DEFAULT_TEXT_STYLE);
  const [loading, setLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const stageRefs = useRef<Map<string, Konva.Stage>>(new Map());
  const editorRef = useRef<EditorHandle | null>(null);

  const activePage = useMemo(
    () => pages.find((p) => p.id === activeId) ?? null,
    [pages, activeId]
  );

  useEffect(() => {
    onLoadingChange?.(loading);
  }, [loading, onLoadingChange]);

  useEffect(() => {
    onContentChange?.(pages.length > 0);
  }, [pages.length, onContentChange]);

  const registerStageRef = useCallback(
    (pageId: string, ref: Konva.Stage | null) => {
      if (ref) stageRefs.current.set(pageId, ref);
      else stageRefs.current.delete(pageId);
    },
    []
  );

  const handleUploadClick = () => fileInputRef.current?.click();

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setLoading(true);
    try {
      const newPages: PageDoc[] = [];
      for (const file of Array.from(fileList)) {
        const fileId = `f_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
          const rendered = await renderPdfToImages(file, 2);
          for (const r of rendered) {
            newPages.push({
              id: `p_${fileId}_${r.pageIndex}`,
              parentFileId: fileId,
              parentFileName: file.name,
              parentKind: "pdf",
              pageIndex: r.pageIndex,
              pageCount: r.pageCount,
              imageDataUrl: r.imageDataUrl,
              width: r.width,
              height: r.height,
              annotations: [],
              history: [],
            });
          }
        } else if (file.type.startsWith("image/")) {
          const { dataUrl, width, height } = await readImageFile(file);
          newPages.push({
            id: `p_${fileId}_0`,
            parentFileId: fileId,
            parentFileName: file.name,
            parentKind: "image",
            pageIndex: 0,
            pageCount: 1,
            imageDataUrl: dataUrl,
            width,
            height,
            annotations: [],
            history: [],
          });
        }
      }
      setPages((prev) => {
        const merged = [...prev, ...newPages];
        if (!activeId && merged.length > 0) {
          setActiveId(merged[0].id);
        }
        return merged;
      });
    } catch (err) {
      console.error(err);
      alert("文件解析失败，请检查文件格式。");
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleChangeAnnotations = useCallback(
    (pageId: string, next: Annotation[], prev: Annotation[]) => {
      setPages((all) =>
        all.map((p) =>
          p.id === pageId
            ? { ...p, annotations: next, history: [...p.history, prev] }
            : p
        )
      );
    },
    []
  );

  const handleUndo = useCallback(() => {
    setPages((all) => {
      if (!activeId) return all;
      const target = all.find((p) => p.id === activeId);
      if (!target || target.history.length === 0) return all;
      return all.map((p) => {
        if (p.id !== activeId) return p;
        const hist = p.history.slice();
        const prev = hist.pop()!;
        return { ...p, annotations: prev, history: hist };
      });
    });
  }, [activeId]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isUndo =
        (e.ctrlKey || e.metaKey) &&
        !e.shiftKey &&
        !e.altKey &&
        e.key.toLowerCase() === "z";
      if (!isUndo) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        target?.isContentEditable
      ) {
        return;
      }
      e.preventDefault();
      handleUndo();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleUndo]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        target?.isContentEditable
      ) {
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key === "1" || e.code === "Digit1" || e.code === "Numpad1") {
        e.preventDefault();
        setMode("select");
        return;
      }
      if (e.key === "2" || e.code === "Digit2" || e.code === "Numpad2") {
        e.preventDefault();
        setMode("erase");
        return;
      }
      if (e.key === "3" || e.code === "Digit3" || e.code === "Numpad3") {
        e.preventDefault();
        setMode("text");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (import.meta.env.DEV) {
      (
        window as unknown as { __getStage?: () => Konva.Stage | undefined }
      ).__getStage = () => [...stageRefs.current.values()][0];
    }
  }, []);

  const handleRemove = (id: string) => {
    setPages((all) => all.filter((p) => p.id !== id));
    setActiveId((cur) => {
      if (cur !== id) return cur;
      const remaining = pages.filter((p) => p.id !== id);
      return remaining[0]?.id ?? null;
    });
  };

  const exportPageDataUrl = async (page: PageDoc): Promise<string> => {
    const stage = stageRefs.current.get(page.id);
    if (stage) {
      return stage.toDataURL({
        pixelRatio: page.width / Math.max(1, stage.width()),
        mimeType: "image/png",
      });
    }
    return await renderHeadless(page);
  };

  const handleDownloadCurrent = async () => {
    if (!activePage) return;
    setLoading(true);
    try {
      if (activePage.parentKind === "image") {
        const url = await exportPageDataUrl(activePage);
        const blob = await (await fetch(url)).blob();
        triggerDownload(
          blob,
          `${stripExtension(activePage.parentFileName)}-edited.png`
        );
      } else {
        const allOfFile = pages.filter(
          (p) => p.parentFileId === activePage.parentFileId
        );
        const items = await Promise.all(
          allOfFile.map(async (p) => ({
            dataUrl: await exportPageDataUrl(p),
            width: p.width,
            height: p.height,
          }))
        );
        const bytes = await imagesToPdf(items);
        triggerDownload(
          new Blob([bytes as BlobPart], { type: "application/pdf" }),
          `${stripExtension(activePage.parentFileName)}-edited.pdf`
        );
      }
    } catch (e) {
      console.error(e);
      alert("下载失败，请重试。");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadAll = async () => {
    if (pages.length === 0) return;
    setLoading(true);
    try {
      const groups = new Map<string, PageDoc[]>();
      for (const p of pages) {
        const arr = groups.get(p.parentFileId) ?? [];
        arr.push(p);
        groups.set(p.parentFileId, arr);
      }

      const zip = new JSZip();
      const usedNames = new Set<string>();
      const uniqueName = (base: string) => {
        if (!usedNames.has(base)) {
          usedNames.add(base);
          return base;
        }
        const dot = base.lastIndexOf(".");
        const stem = dot > 0 ? base.slice(0, dot) : base;
        const ext = dot > 0 ? base.slice(dot) : "";
        let i = 2;
        while (usedNames.has(`${stem}-${i}${ext}`)) i++;
        const next = `${stem}-${i}${ext}`;
        usedNames.add(next);
        return next;
      };

      for (const arr of groups.values()) {
        const first = arr[0];
        if (first.parentKind === "image") {
          const url = await exportPageDataUrl(first);
          const blob = await (await fetch(url)).blob();
          const name = uniqueName(
            `${stripExtension(first.parentFileName)}-edited.png`
          );
          zip.file(name, blob);
        } else {
          const sorted = [...arr].sort((a, b) => a.pageIndex - b.pageIndex);
          const items = await Promise.all(
            sorted.map(async (p) => ({
              dataUrl: await exportPageDataUrl(p),
              width: p.width,
              height: p.height,
            }))
          );
          const bytes = await imagesToPdf(items);
          const name = uniqueName(
            `${stripExtension(first.parentFileName)}-edited.pdf`
          );
          zip.file(name, bytes);
        }
      }

      const zipBlob = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
      });
      const stamp = formatStamp(new Date());
      triggerDownload(zipBlob, `processed-${stamp}.zip`);
    } catch (e) {
      console.error(e);
      alert("批量下载失败。");
    } finally {
      setLoading(false);
    }
  };

  const handleAddText = () => {
    if (!activePage) return;
    if (!textStyle.text.trim()) return;
    editorRef.current?.insertTextAtCenter();
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <Toolbar
        mode={mode}
        onModeChange={setMode}
        textStyle={textStyle}
        onTextStyleChange={setTextStyle}
        onAddText={handleAddText}
        canAddText={!!activePage}
        canUndo={(activePage?.history.length ?? 0) > 0}
        onUndo={handleUndo}
        canDownload={pages.length > 0}
        onDownloadCurrent={handleDownloadCurrent}
        onDownloadAll={handleDownloadAll}
      />

      <div className="flex-1 flex min-h-0">
        <Sidebar
          pages={pages}
          activeId={activeId}
          onSelect={setActiveId}
          onUploadClick={handleUploadClick}
          onRemove={handleRemove}
        />

        <main className="flex-1 flex flex-col min-w-0">
          <Editor
            ref={editorRef}
            page={activePage}
            mode={mode}
            textStyle={textStyle}
            onChangeAnnotations={handleChangeAnnotations}
            onModeChange={setMode}
            registerStageRef={registerStageRef}
          />
          <div className="bg-white border-t border-gray-200 px-4 py-1.5 text-[11px] text-gray-500">
            {activePage ? (
              <>
                当前模式：
                <span className="text-brand-700 font-medium mx-1">
                  {modeLabel(mode)}
                </span>
                {mode === "erase" && "· 在画布上拖拽矩形即可擦除"}
                {mode === "text" && "· 配置好文字后点击画布即可放置"}
                {mode === "select" &&
                  "· 点击文字 / 擦除矩形可拖动或缩放 · 选中后按 Delete 删除"}
                <span className="ml-2 text-gray-400">
                  · 快捷键 1/2/3 切换模式 · Ctrl+Z 撤销 · Ctrl + 鼠标滚轮 缩放画板
                </span>
              </>
            ) : (
              "等待上传文件..."
            )}
          </div>
        </main>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}

function modeLabel(m: EditorMode) {
  if (m === "erase") return "框选擦除";
  if (m === "text") return "添加文字";
  return "选择";
}

function formatStamp(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    d.getFullYear().toString() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  );
}

async function renderHeadless(page: PageDoc): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = page.width;
  canvas.height = page.height;
  const ctx = canvas.getContext("2d")!;

  await new Promise<void>((resolve) => {
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, page.width, page.height);
      resolve();
    };
    img.onerror = () => resolve();
    img.src = page.imageDataUrl;
  });

  for (const a of page.annotations) {
    if (a.kind === "erase") {
      ctx.fillStyle = a.fill;
      ctx.fillRect(a.x, a.y, a.width, a.height);
    } else {
      const fontStyle = `${a.italic ? "italic " : ""}${
        a.bold ? "bold " : ""
      }${a.fontSize}px ${a.fontFamily}`;
      ctx.font = fontStyle;
      ctx.fillStyle = a.fill;
      ctx.textBaseline = "top";
      ctx.fillText(a.text, a.x, a.y);
    }
  }

  return canvas.toDataURL("image/png");
}

export { formatStamp };

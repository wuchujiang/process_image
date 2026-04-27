import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Download,
  FileDown,
  Loader2,
  Trash2,
  Upload,
  XCircle,
  Sparkles,
} from "lucide-react";
import JSZip from "jszip";
import {
  dataUrlToBlob,
  stripExtension,
  triggerDownload,
} from "../utils/download";
import {
  processToWhiteBg,
  type ProcessProgress,
} from "../utils/ecommerce";

type ItemStatus = "pending" | "processing" | "done" | "error";

type EcomItem = {
  id: string;
  fileName: string;
  originalFile: Blob;
  originalUrl: string;
  processedUrl?: string;
  status: ItemStatus;
  stage?: ProcessProgress["stage"];
  progress?: number;
  error?: string;
};

type Props = {
  onLoadingChange?: (loading: boolean) => void;
  onContentChange?: (hasContent: boolean) => void;
};

const TARGET_SIZE = 800;

export default function EcommercePage({
  onLoadingChange,
  onContentChange,
}: Props) {
  const [items, setItems] = useState<EcomItem[]>([]);
  const [running, setRunning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const queueRef = useRef<EcomItem[]>([]);
  const processingRef = useRef(false);

  useEffect(() => {
    onLoadingChange?.(running);
  }, [running, onLoadingChange]);

  useEffect(() => {
    onContentChange?.(items.length > 0);
  }, [items.length, onContentChange]);

  useEffect(() => {
    return () => {
      items.forEach((it) => URL.revokeObjectURL(it.originalUrl));
    };
  }, [items]);

  const updateItem = useCallback((id: string, patch: Partial<EcomItem>) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, ...patch } : it))
    );
  }, []);

  const drainQueue = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;
    setRunning(true);
    try {
      while (queueRef.current.length > 0) {
        const next = queueRef.current.shift()!;
        updateItem(next.id, {
          status: "processing",
          stage: "removing-bg",
          progress: 0,
        });
        try {
          const dataUrl = await processToWhiteBg(next.originalFile, {
            onProgress: (p) => {
              updateItem(next.id, {
                stage: p.stage,
                progress: p.ratio ?? undefined,
              });
            },
          });
          updateItem(next.id, {
            status: "done",
            stage: "done",
            progress: 1,
            processedUrl: dataUrl,
          });
        } catch (e) {
          console.error(e);
          updateItem(next.id, {
            status: "error",
            error: (e as Error)?.message ?? String(e),
          });
        }
      }
    } finally {
      processingRef.current = false;
      setRunning(false);
    }
  }, [updateItem]);

  const handleAddFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const fresh: EcomItem[] = [];
      for (const f of Array.from(files)) {
        if (!f.type.startsWith("image/")) continue;
        const id = `e_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        fresh.push({
          id,
          fileName: f.name,
          originalFile: f,
          originalUrl: URL.createObjectURL(f),
          status: "pending",
        });
      }
      if (fresh.length === 0) return;
      setItems((prev) => [...prev, ...fresh]);
      queueRef.current.push(...fresh);
      void drainQueue();
    },
    [drainQueue]
  );

  const handleRemove = (id: string) => {
    setItems((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.originalUrl);
      return prev.filter((p) => p.id !== id);
    });
    queueRef.current = queueRef.current.filter((q) => q.id !== id);
  };

  const handleClear = () => {
    items.forEach((it) => URL.revokeObjectURL(it.originalUrl));
    setItems([]);
    queueRef.current = [];
  };

  const handleRetry = (id: string) => {
    const target = items.find((p) => p.id === id);
    if (!target) return;
    updateItem(id, {
      status: "pending",
      progress: 0,
      stage: undefined,
      processedUrl: undefined,
      error: undefined,
    });
    queueRef.current.push(target);
    void drainQueue();
  };

  const handleDownloadOne = (it: EcomItem) => {
    if (!it.processedUrl) return;
    const blob = dataUrlToBlob(it.processedUrl);
    const name = `${stripExtension(it.fileName)}-white-${TARGET_SIZE}.png`;
    triggerDownload(blob, name);
  };

  const handleDownloadAll = async () => {
    const dones = items.filter((it) => it.status === "done" && it.processedUrl);
    if (dones.length === 0) return;
    const zip = new JSZip();
    const used = new Set<string>();
    for (const it of dones) {
      let base = `${stripExtension(it.fileName)}-white-${TARGET_SIZE}.png`;
      if (used.has(base)) {
        const stem = base.slice(0, -4);
        let i = 2;
        while (used.has(`${stem}-${i}.png`)) i++;
        base = `${stem}-${i}.png`;
      }
      used.add(base);
      zip.file(base, dataUrlToBlob(it.processedUrl!));
    }
    const blob = await zip.generateAsync({
      type: "blob",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });
    const stamp = formatStamp(new Date());
    triggerDownload(blob, `ecom-white-${TARGET_SIZE}-${stamp}.zip`);
  };

  const doneCount = items.filter((it) => it.status === "done").length;
  const errorCount = items.filter((it) => it.status === "error").length;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex flex-wrap items-center gap-3">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-brand-600 text-white text-sm hover:bg-brand-700"
          title="选择图片，自动抠图并合成 800×800 白底"
        >
          <Upload size={14} />
          上传图片
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            handleAddFiles(e.target.files);
            if (fileInputRef.current) fileInputRef.current.value = "";
          }}
        />

        <button
          onClick={handleClear}
          disabled={items.length === 0 || running}
          className="flex items-center gap-1 px-3 py-1.5 rounded-md border border-gray-300 bg-white text-sm hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          title="清空当前列表"
        >
          <Trash2 size={14} />
          清空
        </button>

        <div className="ml-auto flex items-center gap-2 text-xs text-gray-600">
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-gray-100">
            <Sparkles size={12} className="text-brand-600" />
            自动美化（亮度/对比/饱和/锐化）
          </span>
          {items.length > 0 && (
            <span className="text-gray-500">
              共 {items.length} 张 · 完成 {doneCount}
              {errorCount > 0 && ` · 失败 ${errorCount}`}
            </span>
          )}
        </div>

        <button
          onClick={handleDownloadAll}
          disabled={doneCount === 0}
          className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-brand-600 text-white text-sm hover:bg-brand-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          title="将所有处理完成的图片打包为 zip"
        >
          <FileDown size={14} />
          下载全部 (zip)
        </button>
      </div>

      <div className="flex-1 overflow-auto px-4 py-4 bg-gray-50">
        {items.length === 0 ? (
          <EmptyState onPick={() => fileInputRef.current?.click()} />
        ) : (
          <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(280px,1fr))]">
            {items.map((it) => (
              <Card
                key={it.id}
                item={it}
                onRemove={() => handleRemove(it.id)}
                onDownload={() => handleDownloadOne(it)}
                onRetry={() => handleRetry(it.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Card({
  item,
  onRemove,
  onDownload,
  onRetry,
}: {
  item: EcomItem;
  onRemove: () => void;
  onDownload: () => void;
  onRetry: () => void;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden flex flex-col">
      <div className="grid grid-cols-2 gap-px bg-gray-100">
        <div className="bg-white aspect-square flex items-center justify-center overflow-hidden">
          <img
            src={item.originalUrl}
            alt="original"
            className="max-w-full max-h-full object-contain"
          />
        </div>
        <div className="bg-[#fafafa] aspect-square flex items-center justify-center overflow-hidden relative">
          {item.processedUrl ? (
            <img
              src={item.processedUrl}
              alt="processed"
              className="max-w-full max-h-full object-contain"
              style={{
                backgroundImage:
                  "linear-gradient(45deg,#eee 25%,transparent 25%),linear-gradient(-45deg,#eee 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#eee 75%),linear-gradient(-45deg,transparent 75%,#eee 75%)",
                backgroundSize: "16px 16px",
                backgroundPosition: "0 0,0 8px,8px -8px,-8px 0",
              }}
            />
          ) : (
            <ProcessingOverlay item={item} />
          )}
        </div>
      </div>

      <div className="px-3 py-2 flex items-center gap-2 border-t border-gray-100">
        <StatusIcon status={item.status} />
        <div
          className="flex-1 truncate text-xs text-gray-700"
          title={item.fileName}
        >
          {item.fileName}
        </div>
        {item.status === "done" && (
          <button
            onClick={onDownload}
            className="p-1 rounded hover:bg-gray-100 text-brand-700"
            title="下载这张"
          >
            <Download size={14} />
          </button>
        )}
        {item.status === "error" && (
          <button
            onClick={onRetry}
            className="px-2 py-0.5 rounded text-xs text-amber-700 bg-amber-50 hover:bg-amber-100"
            title="重新处理"
          >
            重试
          </button>
        )}
        <button
          onClick={onRemove}
          className="p-1 rounded hover:bg-gray-100 text-gray-500"
          title="移除"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: ItemStatus }) {
  if (status === "done")
    return <CheckCircle2 size={14} className="text-emerald-600" />;
  if (status === "error")
    return <XCircle size={14} className="text-rose-600" />;
  if (status === "processing")
    return <Loader2 size={14} className="text-brand-600 animate-spin" />;
  return <Loader2 size={14} className="text-gray-400" />;
}

function ProcessingOverlay({ item }: { item: EcomItem }) {
  if (item.status === "error") {
    return (
      <div className="flex flex-col items-center text-rose-600 text-xs gap-1 px-3 text-center">
        <XCircle size={20} />
        <div className="font-medium">处理失败</div>
        <div className="text-gray-500 line-clamp-3">{item.error}</div>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center text-gray-500 text-xs gap-2 w-full px-4">
      <Loader2 size={20} className="text-brand-600 animate-spin" />
      <div>{stageLabel(item.stage, item.status)}</div>
      <div className="w-full h-1 bg-gray-200 rounded overflow-hidden">
        <div
          className="h-full bg-brand-500 transition-all"
          style={{ width: `${(item.progress ?? 0) * 100}%` }}
        />
      </div>
    </div>
  );
}

function stageLabel(
  stage: ProcessProgress["stage"] | undefined,
  status: ItemStatus
): string {
  if (status === "pending") return "等待处理...";
  if (stage === "removing-bg") return "AI 抠图中...";
  if (stage === "compositing") return "合成 800×800 白底...";
  if (stage === "beautifying") return "自动美化中...";
  return "处理中...";
}

function EmptyState({ onPick }: { onPick: () => void }) {
  return (
    <button
      onClick={onPick}
      className="w-full h-full min-h-[60vh] flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl bg-white hover:border-brand-500 hover:bg-brand-50/30 transition"
    >
      <Sparkles size={32} className="text-brand-500 mb-3" />
      <div className="text-base font-medium text-gray-700">
        电商白底图 · 一键处理
      </div>
      <div className="text-xs text-gray-500 mt-1">
        AI 自动抠图 · 居中合成 800×800 白底 · 自动美化
      </div>
      <div className="mt-4 px-4 py-2 rounded-md bg-brand-600 text-white text-sm">
        点击上传图片
      </div>
      <div className="text-[11px] text-gray-400 mt-3">
        首次使用会自动下载约 40-80MB 的离线 AI 模型
      </div>
    </button>
  );
}

function formatStamp(d: Date): string {
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

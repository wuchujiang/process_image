import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Stage,
  Layer,
  Image as KImage,
  Rect,
  Text,
  Transformer,
} from "react-konva";
import type Konva from "konva";
import useImage from "use-image";
import { Maximize2, Minus, Plus } from "lucide-react";
import type {
  Annotation,
  EditorMode,
  EraseAnnotation,
  PageDoc,
  TextAnnotation,
  TextStyle,
} from "../types";
import { sampleBackgroundColor } from "../utils/color";

type Props = {
  page: PageDoc | null;
  mode: EditorMode;
  textStyle: TextStyle;
  onChangeAnnotations: (
    pageId: string,
    next: Annotation[],
    prev: Annotation[]
  ) => void;
  onModeChange: (m: EditorMode) => void;
  registerStageRef: (pageId: string, ref: Konva.Stage | null) => void;
};

export type EditorHandle = {
  insertTextAtCenter: () => void;
};

const MAX_W = 1100;
const MAX_H = 760;
const ZOOM_MIN = 0.2;
const ZOOM_MAX = 6;

function EditorImpl(
  {
    page,
    mode,
    textStyle,
    onChangeAnnotations,
    onModeChange,
    registerStageRef,
  }: Props,
  ref: React.Ref<EditorHandle>
) {
  const stageRef = useRef<Konva.Stage | null>(null);
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [drawing, setDrawing] = useState<null | {
    x: number;
    y: number;
    width: number;
    height: number;
  }>(null);

  const [image] = useImage(page?.imageDataUrl ?? "", "anonymous");

  const baseScale = useMemo(() => {
    if (!page) return 1;
    return Math.min(MAX_W / page.width, MAX_H / page.height, 1);
  }, [page]);

  const effScale = baseScale * zoom;
  const displayW = page ? page.width * effScale : 0;
  const displayH = page ? page.height * effScale : 0;

  useEffect(() => {
    setZoom(1);
  }, [page?.id]);

  useEffect(() => {
    if (page && stageRef.current) {
      registerStageRef(page.id, stageRef.current);
    }
    return () => {
      if (page) registerStageRef(page.id, null);
    };
  }, [page, registerStageRef, displayW, displayH]);

  useEffect(() => {
    setSelectedId(null);
  }, [page?.id]);

  useEffect(() => {
    if (mode !== "select") setSelectedId(null);
  }, [mode]);

  useEffect(() => {
    const tr = transformerRef.current;
    const stage = stageRef.current;
    if (!tr || !stage) return;
    if (mode === "select" && selectedId) {
      const node = stage.findOne("#" + selectedId);
      if (node) {
        tr.nodes([node]);
        tr.getLayer()?.batchDraw();
        return;
      }
    }
    tr.nodes([]);
    tr.getLayer()?.batchDraw();
  }, [selectedId, mode, page?.annotations]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onWheel = (ev: WheelEvent) => {
      if (!ev.ctrlKey && !ev.metaKey) return;
      ev.preventDefault();
      setZoom((prev) => {
        const factor = ev.deltaY > 0 ? 1 / 1.1 : 1.1;
        return clamp(prev * factor, ZOOM_MIN, ZOOM_MAX);
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [page?.id]);

  useEffect(() => {
    if (!page) return;
    if (mode !== "select" || !selectedId) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
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
      e.preventDefault();
      const next = page.annotations.filter((a) => a.id !== selectedId);
      onChangeAnnotations(page.id, next, page.annotations);
      setSelectedId(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [mode, selectedId, page, onChangeAnnotations]);

  useImperativeHandle(
    ref,
    () => ({
      insertTextAtCenter: () => {
        if (!page) return;
        if (!textStyle.text.trim()) return;
        const cx = Math.max(20, page.width / 2 - textStyle.fontSize * 2);
        const cy = Math.max(20, page.height / 2 - textStyle.fontSize / 2);
        const ann: TextAnnotation = {
          id: cryptoId(),
          kind: "text",
          x: cx,
          y: cy,
          text: textStyle.text,
          fontSize: textStyle.fontSize,
          fontFamily: textStyle.fontFamily,
          fill: textStyle.fill,
          bold: textStyle.bold,
          italic: textStyle.italic,
        };
        if (mode !== "select") onModeChange("select");
        onChangeAnnotations(
          page.id,
          [...page.annotations, ann],
          page.annotations
        );
        setSelectedId(ann.id);
      },
    }),
    [page, textStyle, mode, onModeChange, onChangeAnnotations]
  );

  if (!page) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
        请先在左侧上传图片或 PDF
      </div>
    );
  }

  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage();
    if (!stage) return;
    const pos = stage.getPointerPosition();
    if (!pos) return;
    const x = pos.x / effScale;
    const y = pos.y / effScale;

    if (mode === "erase") {
      setDrawing({ x, y, width: 0, height: 0 });
      return;
    }

    if (mode === "text") {
      const txt = textStyle.text.trim();
      if (!txt) return;
      addTextAt(x, y);
      return;
    }

    if (mode === "select") {
      if (e.target === stage || e.target.getClassName() === "Image") {
        setSelectedId(null);
      }
    }
  };

  const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (mode !== "erase" || !drawing) return;
    const stage = e.target.getStage();
    if (!stage) return;
    const pos = stage.getPointerPosition();
    if (!pos) return;
    const x = pos.x / effScale;
    const y = pos.y / effScale;
    setDrawing({
      x: drawing.x,
      y: drawing.y,
      width: x - drawing.x,
      height: y - drawing.y,
    });
  };

  const handleMouseUp = () => {
    if (mode !== "erase" || !drawing) return;
    const rect = normalizeRect(drawing);
    setDrawing(null);
    if (rect.width < 4 || rect.height < 4) return;

    let fill = "#ffffff";
    if (image) {
      fill = sampleBackgroundColor(image, rect, page.width, page.height);
    }
    const ann: EraseAnnotation = {
      id: cryptoId(),
      kind: "erase",
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      fill,
    };
    commit([...page.annotations, ann]);
  };

  const addTextAt = (x: number, y: number) => {
    const ann: TextAnnotation = {
      id: cryptoId(),
      kind: "text",
      x,
      y,
      text: textStyle.text,
      fontSize: textStyle.fontSize,
      fontFamily: textStyle.fontFamily,
      fill: textStyle.fill,
      bold: textStyle.bold,
      italic: textStyle.italic,
    };
    commit([...page.annotations, ann]);
    setSelectedId(ann.id);
  };

  const commit = (next: Annotation[]) => {
    onChangeAnnotations(page.id, next, page.annotations);
  };

  const updateAnnotation = (id: string, patch: Partial<Annotation>) => {
    const next = page.annotations.map((a) =>
      a.id === id ? ({ ...a, ...patch } as Annotation) : a
    );
    commit(next);
  };

  const cursor =
    mode === "erase" ? "crosshair" : mode === "text" ? "text" : "default";

  const zoomIn = () => setZoom((z) => clamp(z * 1.2, ZOOM_MIN, ZOOM_MAX));
  const zoomOut = () => setZoom((z) => clamp(z / 1.2, ZOOM_MIN, ZOOM_MAX));
  const zoomReset = () => setZoom(1);
  const zoomFit = () => {
    const el = scrollerRef.current;
    if (!el) {
      setZoom(1);
      return;
    }
    const padding = 48;
    const availW = Math.max(40, el.clientWidth - padding);
    const availH = Math.max(40, el.clientHeight - padding);
    const fit = Math.min(
      availW / (page.width * baseScale),
      availH / (page.height * baseScale)
    );
    setZoom(clamp(fit, ZOOM_MIN, ZOOM_MAX));
  };

  return (
    <div className="flex-1 relative min-w-0">
      <div
        ref={scrollerRef}
        className="absolute inset-0 overflow-auto bg-gray-100"
        style={{
          display: "flex",
          alignItems: "safe center",
          justifyContent: "safe center",
          padding: 24,
        }}
      >
        <div
          className="bg-white shadow-lg rounded-md shrink-0"
          style={{ width: displayW, height: displayH, cursor }}
        >
          <Stage
            ref={stageRef}
            width={displayW}
            height={displayH}
            scaleX={effScale}
            scaleY={effScale}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onTouchStart={handleMouseDown as unknown as () => void}
            onTouchMove={handleMouseMove as unknown as () => void}
            onTouchEnd={handleMouseUp}
          >
            <Layer listening={false}>
              {image && (
                <KImage
                  image={image}
                  width={page.width}
                  height={page.height}
                  listening={false}
                />
              )}
            </Layer>

            <Layer>
              {page.annotations.map((a) => {
                if (a.kind === "erase") {
                  return (
                    <Rect
                      key={a.id}
                      id={a.id}
                      x={a.x}
                      y={a.y}
                      width={a.width}
                      height={a.height}
                      fill={a.fill}
                      listening={mode === "select"}
                      draggable={mode === "select"}
                      onClick={() =>
                        mode === "select" ? setSelectedId(a.id) : null
                      }
                      onTap={() =>
                        mode === "select" ? setSelectedId(a.id) : null
                      }
                      onDragEnd={(e) =>
                        updateAnnotation(a.id, {
                          x: e.target.x(),
                          y: e.target.y(),
                        })
                      }
                      onTransformEnd={(e) => {
                        const node = e.target as Konva.Rect;
                        const sx = node.scaleX();
                        const sy = node.scaleY();
                        node.scaleX(1);
                        node.scaleY(1);
                        updateAnnotation(a.id, {
                          x: node.x(),
                          y: node.y(),
                          width: Math.max(4, a.width * sx),
                          height: Math.max(4, a.height * sy),
                        });
                      }}
                    />
                  );
                }

                const t = a as TextAnnotation;
                const fontStyle = `${t.italic ? "italic " : ""}${
                  t.bold ? "bold" : "normal"
                }`;
                return (
                  <Text
                    key={t.id}
                    id={t.id}
                    x={t.x}
                    y={t.y}
                    text={t.text}
                    fontSize={t.fontSize}
                    fontFamily={t.fontFamily}
                    fill={t.fill}
                    fontStyle={fontStyle}
                    draggable={mode === "select"}
                    onClick={() =>
                      mode === "select" ? setSelectedId(t.id) : null
                    }
                    onTap={() =>
                      mode === "select" ? setSelectedId(t.id) : null
                    }
                    onDblClick={() => {
                      const next = window.prompt("修改文字内容", t.text);
                      if (next != null) updateAnnotation(t.id, { text: next });
                    }}
                    onDragEnd={(e) =>
                      updateAnnotation(t.id, {
                        x: e.target.x(),
                        y: e.target.y(),
                      })
                    }
                    onTransformEnd={(e) => {
                      const node = e.target as Konva.Text;
                      const s = node.scaleX();
                      node.scaleX(1);
                      node.scaleY(1);
                      updateAnnotation(t.id, {
                        x: node.x(),
                        y: node.y(),
                        fontSize: Math.max(6, t.fontSize * s),
                      });
                    }}
                  />
                );
              })}

              {drawing && (
                <Rect
                  x={drawing.x}
                  y={drawing.y}
                  width={drawing.width}
                  height={drawing.height}
                  fill="rgba(59, 130, 246, 0.15)"
                  stroke="#3b82f6"
                  strokeWidth={1 / effScale}
                  dash={[6 / effScale, 4 / effScale]}
                  listening={false}
                />
              )}

              {mode === "select" && (
                <Transformer
                  ref={transformerRef}
                  rotateEnabled={false}
                  anchorSize={8}
                  borderStroke="#2563eb"
                  anchorStroke="#2563eb"
                  anchorFill="#ffffff"
                  ignoreStroke
                />
              )}
            </Layer>
          </Stage>
        </div>
      </div>

      <ZoomControl
        zoom={zoom}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onReset={zoomReset}
        onFit={zoomFit}
      />
    </div>
  );
}

const Editor = forwardRef<EditorHandle, Props>(EditorImpl);
export default Editor;

function ZoomControl({
  zoom,
  onZoomIn,
  onZoomOut,
  onReset,
  onFit,
}: {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  onFit: () => void;
}) {
  return (
    <div className="absolute bottom-4 right-4 flex items-center gap-1 bg-white/95 backdrop-blur shadow-md rounded-md border border-gray-200 px-1 py-1">
      <button
        onClick={onZoomOut}
        className="p-1.5 rounded hover:bg-gray-100 text-gray-600"
        title="缩小 (Ctrl+滚轮)"
      >
        <Minus size={14} />
      </button>
      <button
        onClick={onReset}
        className="px-2 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded min-w-[3.5rem]"
        title="重置 100%"
      >
        {Math.round(zoom * 100)}%
      </button>
      <button
        onClick={onZoomIn}
        className="p-1.5 rounded hover:bg-gray-100 text-gray-600"
        title="放大 (Ctrl+滚轮)"
      >
        <Plus size={14} />
      </button>
      <div className="w-px h-5 bg-gray-200 mx-0.5" />
      <button
        onClick={onFit}
        className="p-1.5 rounded hover:bg-gray-100 text-gray-600"
        title="适应窗口"
      >
        <Maximize2 size={14} />
      </button>
    </div>
  );
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

function normalizeRect(r: {
  x: number;
  y: number;
  width: number;
  height: number;
}) {
  const x = r.width < 0 ? r.x + r.width : r.x;
  const y = r.height < 0 ? r.y + r.height : r.y;
  return {
    x,
    y,
    width: Math.abs(r.width),
    height: Math.abs(r.height),
  };
}

function cryptoId() {
  return (
    "id_" +
    Math.random().toString(36).slice(2, 9) +
    Date.now().toString(36).slice(-4)
  );
}

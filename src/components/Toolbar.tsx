import {
  MousePointer2,
  SquareDashed,
  Type,
  Undo2,
  Download,
  Bold,
  Italic,
  FileDown,
} from "lucide-react";
import type { EditorMode, TextStyle } from "../types";


const FONT_FAMILIES: { value: string; label: string }[] = [
  { value: "SimSun", label: "宋体" },
  { value: "Microsoft YaHei", label: "微软雅黑" },
  { value: "SimHei", label: "黑体" },
  { value: "KaiTi", label: "楷体" },
  { value: "FangSong", label: "仿宋" },
  { value: "PingFang SC", label: "苹方" },
  { value: "system-ui", label: "System UI" },
  { value: "Arial", label: "Arial" },
  { value: "Helvetica", label: "Helvetica" },
  { value: "Georgia", label: "Georgia" },
  { value: "Times New Roman", label: "Times New Roman" },
  { value: "Courier New", label: "Courier New" },
  { value: "Verdana", label: "Verdana" },
  { value: "Tahoma", label: "Tahoma" },
];

type Props = {
  mode: EditorMode;
  onModeChange: (m: EditorMode) => void;
  textStyle: TextStyle;
  onTextStyleChange: (s: TextStyle) => void;
  onAddText: () => void;
  canAddText: boolean;
  canUndo: boolean;
  onUndo: () => void;
  canDownload: boolean;
  onDownloadCurrent: () => void;
  onDownloadAll: () => void;
};

export default function Toolbar({
  mode,
  onModeChange,
  textStyle,
  onTextStyleChange,
  onAddText: _onAddText,
  canAddText: _canAddText,
  canUndo,
  onUndo,
  canDownload,
  onDownloadCurrent,
  onDownloadAll,
}: Props) {
  return (
    <div className="bg-white border-b border-gray-200 px-4 py-3 flex flex-wrap gap-3 items-center">
      <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
        <ToolBtn
          active={mode === "select"}
          onClick={() => onModeChange("select")}
          icon={<MousePointer2 size={16} />}
          label="选择"
          title="选择 (快捷键 1)"
        />
        <ToolBtn
          active={mode === "erase"}
          onClick={() => onModeChange("erase")}
          icon={<SquareDashed size={16} />}
          label="框选擦除"
          title="框选擦除 (快捷键 2)"
        />
        <ToolBtn
          active={mode === "text"}
          onClick={() => onModeChange("text")}
          icon={<Type size={16} />}
          label="添加文字"
          title="添加文字 (快捷键 3)"
        />
      </div>

      <div className="h-7 w-px bg-gray-200" />

      <div className="flex items-center gap-2 flex-wrap">
        <input
          type="text"
          value={textStyle.text}
          onChange={(e) =>
            onTextStyleChange({ ...textStyle, text: e.target.value })
          }
          placeholder="输入文字内容"
          className="border border-gray-300 rounded-md px-2 py-1.5 text-sm w-44 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />

        <select
          value={textStyle.fontFamily}
          onChange={(e) =>
            onTextStyleChange({ ...textStyle, fontFamily: e.target.value })
          }
          className="border border-gray-300 rounded-md px-2 py-1.5 text-sm bg-white"
          title="字体"
        >
          {FONT_FAMILIES.map((f) => (
            <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>
              {f.label}
            </option>
          ))}
        </select>

        <input
          type="number"
          min={8}
          max={200}
          value={textStyle.fontSize}
          onChange={(e) =>
            onTextStyleChange({
              ...textStyle,
              fontSize: Math.max(8, Number(e.target.value) || 8),
            })
          }
          className="border border-gray-300 rounded-md px-2 py-1.5 text-sm w-20"
          title="字号"
        />

        <label className="flex items-center gap-1 cursor-pointer" title="颜色">
          <span
            className="w-7 h-7 rounded-md border border-gray-300 shadow-inner"
            style={{ background: textStyle.fill }}
          />
          <input
            type="color"
            value={textStyle.fill}
            onChange={(e) =>
              onTextStyleChange({ ...textStyle, fill: e.target.value })
            }
            className="hidden"
          />
        </label>

        <button
          className={`p-1.5 rounded-md border ${
            textStyle.bold
              ? "bg-brand-50 border-brand-500 text-brand-700"
              : "bg-white border-gray-300 text-gray-600"
          }`}
          onClick={() =>
            onTextStyleChange({ ...textStyle, bold: !textStyle.bold })
          }
          title="加粗"
        >
          <Bold size={14} />
        </button>
        <button
          className={`p-1.5 rounded-md border ${
            textStyle.italic
              ? "bg-brand-50 border-brand-500 text-brand-700"
              : "bg-white border-gray-300 text-gray-600"
          }`}
          onClick={() =>
            onTextStyleChange({ ...textStyle, italic: !textStyle.italic })
          }
          title="斜体"
        >
          <Italic size={14} />
        </button>

        {/* <button
          onClick={onAddText}
          disabled={!textStyle.text.trim() || !canAddText}
          className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-brand-600 text-white text-sm hover:bg-brand-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          title={
            !canAddText
              ? "请先上传图片或 PDF"
              : !textStyle.text.trim()
              ? "请先输入文字内容"
              : "将文字添加到画布中央，可拖动到任意位置"
          }
        >
          <Plus size={14} />
          添加文字
        </button> */}
      </div>

      <div className="h-7 w-px bg-gray-200" />

      <button
        onClick={onUndo}
        disabled={!canUndo}
        className="flex items-center gap-1 px-3 py-1.5 rounded-md border border-gray-300 bg-white text-sm hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
        title="撤销 (Ctrl+Z)"
      >
        <Undo2 size={14} />
        撤销
      </button>

      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={onDownloadCurrent}
          disabled={!canDownload}
          className="flex items-center gap-1 px-3 py-1.5 rounded-md border border-gray-300 bg-white text-sm hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          title="导出当前文件（图片为 PNG，PDF 为 PDF）"
        >
          <Download size={14} />
          下载当前
        </button>
        <button
          onClick={onDownloadAll}
          disabled={!canDownload}
          className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-brand-600 text-white text-sm hover:bg-brand-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          title="将所有文件打包成 .zip 一次下载"
        >
          <FileDown size={14} />
          下载全部 (zip)
        </button>
      </div>
    </div>
  );
}

function ToolBtn({
  active,
  onClick,
  icon,
  label,
  title,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-sm transition ${
        active
          ? "bg-white shadow text-brand-700 font-medium"
          : "text-gray-600 hover:text-gray-900"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

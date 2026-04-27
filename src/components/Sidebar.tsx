import { FileImage, FileText, Trash2, Upload } from "lucide-react";
import type { PageDoc } from "../types";

type Props = {
  pages: PageDoc[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onUploadClick: () => void;
  onRemove: (id: string) => void;
};

export default function Sidebar({
  pages,
  activeId,
  onSelect,
  onUploadClick,
  onRemove,
}: Props) {
  return (
    <aside className="w-64 shrink-0 bg-white border-r border-gray-200 flex flex-col">
      <div className="p-3 border-b border-gray-200">
        <button
          onClick={onUploadClick}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-md text-sm font-medium"
        >
          <Upload size={14} />
          批量上传图片 / PDF
        </button>
        <p className="mt-2 text-[11px] text-gray-500 leading-relaxed">
          支持 PNG / JPG / WEBP / PDF。PDF 会按页拆分。
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {pages.length === 0 ? (
          <div className="text-center text-gray-400 py-12 text-xs">
            尚未导入文件
          </div>
        ) : (
          pages.map((p) => {
            const active = p.id === activeId;
            return (
              <div
                key={p.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelect(p.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") onSelect(p.id);
                }}
                className={`w-full text-left rounded-md border p-2 group transition cursor-pointer ${
                  active
                    ? "border-brand-500 bg-brand-50"
                    : "border-gray-200 hover:border-brand-300 hover:bg-gray-50"
                }`}
              >
                <div className="flex gap-2">
                  <div className="w-14 h-14 shrink-0 rounded bg-gray-100 overflow-hidden border border-gray-200">
                    <img
                      src={p.imageDataUrl}
                      alt=""
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1 text-[11px] text-gray-500">
                      {p.parentKind === "pdf" ? (
                        <FileText size={12} />
                      ) : (
                        <FileImage size={12} />
                      )}
                      <span className="uppercase">{p.parentKind}</span>
                      {p.parentKind === "pdf" && (
                        <span>
                          · {p.pageIndex + 1}/{p.pageCount}
                        </span>
                      )}
                    </div>
                    <div
                      className={`text-xs mt-0.5 truncate ${
                        active ? "text-brand-700 font-medium" : "text-gray-700"
                      }`}
                      title={p.parentFileName}
                    >
                      {p.parentFileName}
                    </div>
                    <div className="text-[10px] text-gray-400 mt-0.5">
                      {p.width} × {p.height}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(p.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 transition self-start text-gray-400 hover:text-red-500"
                    title="移除"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}

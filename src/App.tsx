import { useEffect, useState } from "react";
import { Wand2, ImageIcon, ShoppingBag } from "lucide-react";
import EditorPage from "./pages/EditorPage";
import EcommercePage from "./pages/EcommercePage";

type Tab = "editor" | "ecommerce";

export default function App() {
  const [tab, setTab] = useState<Tab>("editor");
  const [editorBusy, setEditorBusy] = useState(false);
  const [ecomBusy, setEcomBusy] = useState(false);
  const [editorHasContent, setEditorHasContent] = useState(false);
  const [ecomHasContent, setEcomHasContent] = useState(false);

  const loading = editorBusy || ecomBusy;
  const hasContent = editorHasContent || ecomHasContent;

  useEffect(() => {
    if (!hasContent) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasContent]);

  return (
    <div className="h-full flex flex-col">
      <header className="bg-white border-b border-gray-200 px-5 py-3 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-md bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white">
            <Wand2 size={16} />
          </div>
          <div className="leading-tight">
            <div className="font-semibold text-gray-800">图片处理工坊</div>
            <div className="text-[11px] text-gray-500">
              图片 / PDF 编辑 · 电商白底图一键处理
            </div>
          </div>
        </div>

        <nav className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 ml-2">
          <TabBtn
            active={tab === "editor"}
            onClick={() => setTab("editor")}
            icon={<ImageIcon size={14} />}
            label="图片 / PDF 处理"
          />
          <TabBtn
            active={tab === "ecommerce"}
            onClick={() => setTab("ecommerce")}
            icon={<ShoppingBag size={14} />}
            label="电商白底图"
          />
        </nav>

        {loading && (
          <div className="ml-2 text-xs text-brand-600 flex items-center gap-2">
            <span className="inline-block w-3 h-3 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            处理中...
          </div>
        )}
      </header>

      <div
        className="flex-1 flex flex-col min-h-0"
        style={{ display: tab === "editor" ? "flex" : "none" }}
      >
        <EditorPage
          onLoadingChange={setEditorBusy}
          onContentChange={setEditorHasContent}
        />
      </div>
      <div
        className="flex-1 flex flex-col min-h-0"
        style={{ display: tab === "ecommerce" ? "flex" : "none" }}
      >
        <EcommercePage
          onLoadingChange={setEcomBusy}
          onContentChange={setEcomHasContent}
        />
      </div>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm transition ${
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

# 图片 / PDF 处理工坊

一个基于 React + Konva 的纯前端图片/PDF 处理应用，支持：

- 批量上传图片（PNG / JPG / WEBP）和 PDF 文件，PDF 会按页拆分
- 框选擦除文字：选中"框选擦除"模式，在画布上拖拽矩形即可擦除该区域。擦除色会自动采样矩形边缘像素的中位数颜色，对纯色或近纯色背景的文字效果很好
- 添加自定义文字：在顶部工具栏配置文字内容、字体、字号、颜色、加粗/斜体；点击"添加文字"将其放置在画布中央，或者切换到"添加文字"模式后点击画布任意位置即可放置；切回"选择"模式可拖动、缩放或双击编辑
- 撤销：每次擦除/添加文字均可逐步撤销
- 下载：
  - 图片：导出为 PNG
  - PDF：将该 PDF 所有页面统一编辑后，重新合成为 PDF 下载
  - 也支持"下载全部"，按文件分组依次导出

## 技术栈

- React + TypeScript + Vite
- Konva / react-konva（Canvas 编辑器）
- pdfjs-dist（PDF 转图像渲染）
- pdf-lib（编辑后图像合成 PDF）
- Tailwind CSS、lucide-react

## 启动

```bash
npm install
npm run dev      # 本地开发，访问 http://localhost:5173
npm run build    # 生产构建
npm run preview  # 预览构建产物
```

## 目录结构

```
src/
├── App.tsx                    # 应用主组件（状态、上传、撤销、下载）
├── main.tsx
├── index.css                  # Tailwind 入口
├── types.ts                   # 类型定义
├── components/
│   ├── Toolbar.tsx            # 顶部工具栏
│   ├── Sidebar.tsx            # 左侧文件/页面列表
│   └── Editor.tsx             # 右侧 Konva 编辑器
└── utils/
    ├── pdf.ts                 # PDF 渲染 / 合成
    ├── color.ts               # 擦除背景色采样
    └── download.ts            # 下载 / 文件读取
```

## 设计要点

- 所有文件统一抽象为"页面"（PDF 每页就是一个页面）；擦除矩形和文字都是页面上的"标注"对象，以矢量形式保存，可任意修改/删除/撤销，导出时再合成为最终图像
- 擦除并非真正修改原图像素，而是叠加一个采样背景色的矩形 —— 这种做法可逆、可调整、效果稳定
- 页面状态完全保留在内存中，刷新页面会丢失工作进度（按需可接入 IndexedDB 持久化）

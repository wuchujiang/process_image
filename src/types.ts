export type EraseAnnotation = {
  id: string;
  kind: "erase";
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
};

export type TextAnnotation = {
  id: string;
  kind: "text";
  x: number;
  y: number;
  text: string;
  fontSize: number;
  fontFamily: string;
  fill: string;
  bold: boolean;
  italic: boolean;
};

export type Annotation = EraseAnnotation | TextAnnotation;

export type ParentKind = "image" | "pdf";

export type PageDoc = {
  id: string;
  parentFileId: string;
  parentFileName: string;
  parentKind: ParentKind;
  pageIndex: number;
  pageCount: number;
  imageDataUrl: string;
  width: number;
  height: number;
  annotations: Annotation[];
  history: Annotation[][];
};

export type TextStyle = {
  text: string;
  fontFamily: string;
  fontSize: number;
  fill: string;
  bold: boolean;
  italic: boolean;
};

export type EditorMode = "select" | "erase" | "text";

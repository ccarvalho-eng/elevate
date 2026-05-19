/// <reference types="vite/client" />

import * as pdfjs from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export type NormalizedBlueprint = {
  canvas: HTMLCanvasElement;
  height: number;
  width: number;
};

const pdfRenderScale = 2;
const maxPdfPageDimension = 16_384;
const maxPdfPagePixels = 67_108_864;
const maxPdfCanvasAreaInBytes = maxPdfPagePixels * 4;

type PdfDocumentLoadingTask = ReturnType<typeof pdfjs.getDocument>;
type PdfDocument = Awaited<PdfDocumentLoadingTask["promise"]>;

const readFileBytes = async (file: File): Promise<Uint8Array> => {
  if (typeof file.arrayBuffer === "function") {
    return new Uint8Array(await file.arrayBuffer());
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (!(reader.result instanceof ArrayBuffer)) {
        reject(new Error("Could not read PDF blueprint file."));
        return;
      }

      resolve(new Uint8Array(reader.result));
    };
    reader.onerror = () =>
      reject(new Error("Could not read PDF blueprint file."));
    reader.readAsArrayBuffer(file);
  });
};

export const getPdfPageLabel = (
  pageIndex: number,
  totalPages: number,
): string => {
  assertValidPageIndex(pageIndex);
  assertValidTotalPages(totalPages);
  assertPageIndexInRange(pageIndex, totalPages);

  return `Page ${pageIndex + 1} of ${totalPages}`;
};

export const renderPdfPage = async (
  file: File,
  pageIndex: number,
): Promise<NormalizedBlueprint> => {
  assertValidPageIndex(pageIndex);

  const bytes = await readFileBytes(file);
  let loadingTask: PdfDocumentLoadingTask | null = null;
  let pdf: PdfDocument | null = null;

  try {
    loadingTask = pdfjs.getDocument({
      canvasMaxAreaInBytes: maxPdfCanvasAreaInBytes,
      data: bytes,
      isEvalSupported: false,
      maxImageSize: maxPdfPagePixels,
      stopAtErrors: true,
    });
    pdf = await loadingTask.promise;

    assertValidTotalPages(pdf.numPages);
    assertPageIndexInRange(pageIndex, pdf.numPages);

    const page = await pdf.getPage(pageIndex + 1);
    const viewport = page.getViewport({ scale: pdfRenderScale });

    assertValidPageDimensions(viewport.width, viewport.height);

    const canvas = document.createElement("canvas");

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Could not create canvas context for PDF blueprint.");
    }

    await page.render({ canvasContext: context, viewport }).promise;

    return {
      canvas,
      height: viewport.height,
      width: viewport.width,
    };
  } finally {
    await releasePdfResources(pdf, loadingTask);
  }
};

const assertValidPageIndex = (pageIndex: number): void => {
  if (!Number.isInteger(pageIndex) || pageIndex < 0) {
    throw new Error("PDF page index must be a non-negative integer.");
  }
};

const assertValidTotalPages = (totalPages: number): void => {
  if (!Number.isInteger(totalPages) || totalPages <= 0) {
    throw new Error("PDF total pages must be a positive integer.");
  }
};

const assertPageIndexInRange = (
  pageIndex: number,
  totalPages: number,
): void => {
  if (pageIndex >= totalPages) {
    throw new Error("PDF page index must be less than the total page count.");
  }
};

const assertValidPageDimensions = (width: number, height: number): void => {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    throw new Error("PDF page has invalid dimensions.");
  }

  if (
    width > maxPdfPageDimension ||
    height > maxPdfPageDimension ||
    width * height > maxPdfPagePixels
  ) {
    throw new Error("PDF page dimensions exceed the supported limit.");
  }
};

const releasePdfResources = async (
  pdf: PdfDocument | null,
  loadingTask: PdfDocumentLoadingTask | null,
): Promise<void> => {
  if (pdf) {
    await pdf.cleanup();
    await pdf.destroy();
  }

  if (loadingTask && !loadingTask.destroyed) {
    await loadingTask.destroy();
  }
};

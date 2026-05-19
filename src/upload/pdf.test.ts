import { beforeEach, describe, expect, it, vi } from "vitest";

import * as pdfjs from "pdfjs-dist";

import { getPdfPageLabel, renderPdfPage } from "./pdf";

vi.mock("pdfjs-dist", () => ({
  GlobalWorkerOptions: {},
  getDocument: vi.fn(),
}));

const makeFile = () =>
  new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])], "plan.pdf", {
    type: "application/pdf",
  });

const mockDocumentLoad = (
  promise: Promise<unknown>,
  destroy = vi.fn(async () => undefined),
) => {
  const loadingTask = {
    destroy,
    promise,
  };

  vi.mocked(pdfjs.getDocument).mockReturnValue(
    loadingTask as unknown as ReturnType<typeof pdfjs.getDocument>,
  );

  return loadingTask;
};

describe("getPdfPageLabel", () => {
  it("formats a one-based page label with the total page count", () => {
    expect(getPdfPageLabel(0, 3)).toBe("Page 1 of 3");
    expect(getPdfPageLabel(2, 3)).toBe("Page 3 of 3");
  });

  it("rejects labels with invalid page invariants", () => {
    expect(() => getPdfPageLabel(-1, 3)).toThrow(
      "PDF page index must be a non-negative integer.",
    );
    expect(() => getPdfPageLabel(1.5, 3)).toThrow(
      "PDF page index must be a non-negative integer.",
    );
    expect(() => getPdfPageLabel(0, 0)).toThrow(
      "PDF total pages must be a positive integer.",
    );
    expect(() => getPdfPageLabel(3, 3)).toThrow(
      "PDF page index must be less than the total page count.",
    );
  });
});

describe("renderPdfPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(pdfjs.getDocument).mockReset();
  });

  it("configures the PDF.js worker source for Vite", () => {
    expect(pdfjs.GlobalWorkerOptions.workerSrc).toContain("pdf.worker");
  });

  it("renders the selected PDF page into a scale 2 canvas", async () => {
    const viewport = { width: 800, height: 600 };
    const renderPromise = Promise.resolve();
    const canvasContext = {} as CanvasRenderingContext2D;
    const render = vi.fn(() => ({ promise: renderPromise }));
    const getViewport = vi.fn(() => viewport);
    const cleanup = vi.fn(async () => undefined);
    const destroyDocument = vi.fn(async () => undefined);
    const getPage = vi.fn(async () => ({
      getViewport,
      render,
    }));
    const document = {
      cleanup,
      destroy: destroyDocument,
      getPage,
      numPages: 3,
    };

    const loadingTask = mockDocumentLoad(Promise.resolve(document));
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      canvasContext,
    );

    const result = await renderPdfPage(makeFile(), 1);
    const documentRequest = vi.mocked(pdfjs.getDocument).mock.calls[0]?.[0] as
      | { data: Uint8Array }
      | undefined;

    if (!documentRequest) {
      throw new Error("Expected PDF document to be requested.");
    }

    expect(documentRequest).toEqual({
      canvasMaxAreaInBytes: 268_435_456,
      data: expect.any(Uint8Array),
      isEvalSupported: false,
      maxImageSize: 67_108_864,
      stopAtErrors: true,
    });
    expect([...documentRequest.data]).toEqual([0x25, 0x50, 0x44, 0x46, 0x2d]);
    expect(getPage).toHaveBeenCalledWith(2);
    expect(getViewport).toHaveBeenCalledWith({ scale: 2 });
    expect(render).toHaveBeenCalledWith({
      canvasContext,
      viewport,
    });
    expect(result.canvas).toBeInstanceOf(HTMLCanvasElement);
    expect(result.width).toBe(800);
    expect(result.height).toBe(600);
    expect(result.canvas.width).toBe(800);
    expect(result.canvas.height).toBe(600);
    expect(cleanup).toHaveBeenCalledOnce();
    expect(destroyDocument).toHaveBeenCalledOnce();
    expect(loadingTask.destroy).toHaveBeenCalledOnce();
  });

  it("throws a clear error when the PDF canvas context is unavailable", async () => {
    const render = vi.fn();
    const cleanup = vi.fn(async () => undefined);
    const destroyDocument = vi.fn(async () => undefined);
    const document = {
      cleanup,
      destroy: destroyDocument,
      getPage: vi.fn(async () => ({
        getViewport: vi.fn(() => ({ width: 800, height: 600 })),
        render,
      })),
      numPages: 1,
    };

    const loadingTask = mockDocumentLoad(Promise.resolve(document));
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);

    await expect(renderPdfPage(makeFile(), 0)).rejects.toThrow(
      "Could not create canvas context for PDF blueprint.",
    );
    expect(render).not.toHaveBeenCalled();
    expect(cleanup).toHaveBeenCalledOnce();
    expect(destroyDocument).toHaveBeenCalledOnce();
    expect(loadingTask.destroy).toHaveBeenCalledOnce();
  });

  it("rejects invalid page indexes before loading a PDF when possible", async () => {
    await expect(renderPdfPage(makeFile(), -1)).rejects.toThrow(
      "PDF page index must be a non-negative integer.",
    );
    await expect(renderPdfPage(makeFile(), 1.5)).rejects.toThrow(
      "PDF page index must be a non-negative integer.",
    );
    expect(pdfjs.getDocument).not.toHaveBeenCalled();
  });

  it("rejects page indexes outside the loaded PDF page count before requesting a page", async () => {
    const cleanup = vi.fn(async () => undefined);
    const destroyDocument = vi.fn(async () => undefined);
    const getPage = vi.fn();
    const document = {
      cleanup,
      destroy: destroyDocument,
      getPage,
      numPages: 2,
    };
    const loadingTask = mockDocumentLoad(Promise.resolve(document));

    await expect(renderPdfPage(makeFile(), 2)).rejects.toThrow(
      "PDF page index must be less than the total page count.",
    );
    expect(getPage).not.toHaveBeenCalled();
    expect(cleanup).toHaveBeenCalledOnce();
    expect(destroyDocument).toHaveBeenCalledOnce();
    expect(loadingTask.destroy).toHaveBeenCalledOnce();
  });

  it("rejects oversized PDF pages before allocating a canvas", async () => {
    const render = vi.fn();
    const cleanup = vi.fn(async () => undefined);
    const destroyDocument = vi.fn(async () => undefined);
    const document = {
      cleanup,
      destroy: destroyDocument,
      getPage: vi.fn(async () => ({
        getViewport: vi.fn(() => ({ width: 20_000, height: 600 })),
        render,
      })),
      numPages: 1,
    };
    const loadingTask = mockDocumentLoad(Promise.resolve(document));
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, "getContext");

    await expect(renderPdfPage(makeFile(), 0)).rejects.toThrow(
      "PDF page dimensions exceed the supported limit.",
    );
    expect(getContext).not.toHaveBeenCalled();
    expect(render).not.toHaveBeenCalled();
    expect(cleanup).toHaveBeenCalledOnce();
    expect(destroyDocument).toHaveBeenCalledOnce();
    expect(loadingTask.destroy).toHaveBeenCalledOnce();
  });
});

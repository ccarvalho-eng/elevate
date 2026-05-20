import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Plan } from "./domain/geometry";
import type { ModelSpec } from "./model/modelBuilder";
import { App } from "./App";

const mocks = vi.hoisted(() => ({
  buildModelSpec: vi.fn((plan) => ({
    floor: {
      center: [0, 0, 0],
      size: [0, 0, 0],
    },
    walls: plan.walls.map((wall: { id: string }) => ({
      wallId: wall.id,
      center: [0, 0, 0],
      size: [0, 0, 0],
      rotationY: 0,
    })),
  })),
  extractPlanFromCanvas: vi.fn(),
  normalizeImageFile: vi.fn(),
  renderPdfPage: vi.fn(),
}));

vi.mock("./blueprint/normalize", () => ({
  normalizeImageFile: mocks.normalizeImageFile,
}));

vi.mock("./extractor/planExtractor", () => ({
  BlueprintExtractionError: class BlueprintExtractionError extends Error {
    code: string;

    constructor(code: string) {
      super(`Blueprint extraction failed: ${code}.`);
      this.name = "BlueprintExtractionError";
      this.code = code;
    }
  },
  extractPlanFromCanvas: mocks.extractPlanFromCanvas,
}));

vi.mock("./model/modelBuilder", () => ({
  buildModelSpec: mocks.buildModelSpec,
}));

vi.mock("./upload/pdf", () => ({
  renderPdfPage: mocks.renderPdfPage,
}));

vi.mock("./viewer/BlueprintViewer", () => ({
  BlueprintViewer: ({ model }: { model: ModelSpec }) => (
    <section aria-label="3D perspective viewer">
      <button type="button">Roof-off</button>
      <button type="button">Exterior</button>
      <output aria-label="model wall ids">
        {model.walls.map((wall) => wall.wallId).join(",")}
      </output>
    </section>
  ),
}));

const pngSignature = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const gifSignature = new Uint8Array([0x47, 0x49, 0x46, 0x38]);
const pdfSignature = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
const sampleCanvas = {} as HTMLCanvasElement;
const generatedCanvas = {} as HTMLCanvasElement;

const makePlan = (prefix: string, wallCount: number): Plan => ({
  width: 100,
  height: 100,
  scale: {
    pixelsPerMeter: 10,
  },
  walls: Array.from({ length: wallCount }, (_, index) => ({
    id: `${prefix}-wall-${index + 1}`,
    segment: {
      start: { x: index * 10, y: 0 },
      end: { x: index * 10 + 5, y: 0 },
    },
    height: 2.7,
    thicknessMeters: 0.15,
    exterior: true,
  })),
  openings: [],
});

const makeModelSpec = (plan: Plan): ModelSpec => ({
  floor: {
    center: [0, 0, 0],
    size: [0, 0, 0],
  },
  walls: plan.walls.map((wall) => ({
    wallId: wall.id,
    center: [0, 0, 0],
    size: [0, 0, 0],
    rotationY: 0,
  })),
});

const makeOversizedFile = (content: Uint8Array, type: string) =>
  ({
    size: 20 * 1024 * 1024 + 1,
    slice: vi.fn(() => ({
      arrayBuffer: vi.fn(async () => content.buffer.slice(0)),
    })),
    type,
  }) as unknown as File;

const makeDeferredHeaderFile = (type: string) => {
  let resolveHeader: (header: ArrayBuffer) => void = () => {};
  const headerPromise = new Promise<ArrayBuffer>((resolve) => {
    resolveHeader = resolve;
  });

  return {
    file: {
      size: pngSignature.byteLength,
      slice: vi.fn(() => ({
        arrayBuffer: vi.fn(() => headerPromise),
      })),
      type,
    } as unknown as File,
    resolveHeader,
  };
};

describe("App", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  beforeEach(() => {
    mocks.buildModelSpec.mockImplementation(makeModelSpec);
    mocks.extractPlanFromCanvas.mockReturnValue(makePlan("generated", 5));
    mocks.normalizeImageFile.mockResolvedValue({
      canvas: generatedCanvas,
      height: 100,
      width: 100,
    });
    mocks.renderPdfPage.mockResolvedValue({
      canvas: generatedCanvas,
      height: 100,
      width: 100,
    });
  });

  it("renders the upload control and sample 3D viewer", () => {
    render(<App />);

    expect(screen.getByLabelText("Upload blueprint")).toBeInTheDocument();
    expect(screen.getByLabelText("3D perspective viewer")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Roof-off" }),
    ).toBeInTheDocument();
  });

  it("shows the validation error before processing an unsupported upload", async () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText("Upload blueprint"), {
      target: {
        files: [
          new File([gifSignature], "blueprint.gif", { type: "image/gif" }),
        ],
      },
    });

    expect(
      await screen.findByText("Upload a PNG, JPG, or PDF blueprint."),
    ).toBeInTheDocument();
    expect(mocks.normalizeImageFile).not.toHaveBeenCalled();
    expect(mocks.renderPdfPage).not.toHaveBeenCalled();
    expect(mocks.extractPlanFromCanvas).not.toHaveBeenCalled();
  });

  it("generates a model from a valid image upload", async () => {
    render(<App />);
    const file = new File([pngSignature], "blueprint.png", {
      type: "image/png",
    });

    fireEvent.change(screen.getByLabelText("Upload blueprint"), {
      target: {
        files: [file],
      },
    });

    expect(
      await screen.findByText("Generated perspective from blueprint."),
    ).toBeInTheDocument();
    expect(mocks.normalizeImageFile).toHaveBeenCalledWith(file);
    expect(mocks.renderPdfPage).not.toHaveBeenCalled();
    expect(mocks.extractPlanFromCanvas).toHaveBeenCalledWith(generatedCanvas);
    expect(screen.getByLabelText("model wall ids")).toHaveTextContent(
      "generated-wall-5",
    );
  });

  it("renders the first PDF page before generating a model", async () => {
    render(<App />);
    const file = new File([pdfSignature], "blueprint.pdf", {
      type: "application/pdf",
    });

    fireEvent.change(screen.getByLabelText("Upload blueprint"), {
      target: {
        files: [file],
      },
    });

    expect(
      await screen.findByText("Generated perspective from blueprint."),
    ).toBeInTheDocument();
    expect(mocks.renderPdfPage).toHaveBeenCalledWith(file, 0);
    expect(mocks.normalizeImageFile).not.toHaveBeenCalled();
    expect(mocks.extractPlanFromCanvas).toHaveBeenCalledWith(generatedCanvas);
  });

  it("keeps the sample model and shows a warning when extraction is too sparse", async () => {
    mocks.extractPlanFromCanvas.mockReturnValue(makePlan("sparse", 3));
    render(<App />);

    fireEvent.change(screen.getByLabelText("Upload blueprint"), {
      target: {
        files: [
          new File([pngSignature], "blueprint.png", { type: "image/png" }),
        ],
      },
    });

    expect(
      await screen.findByText(
        "Could not extract enough walls, so the sample model is still shown.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("model wall ids")).not.toHaveTextContent(
      "sparse-wall",
    );
  });

  it("keeps the sample model and shows a warning for known extraction failures", async () => {
    const { BlueprintExtractionError } =
      await import("./extractor/planExtractor");
    mocks.extractPlanFromCanvas.mockImplementation(() => {
      throw new BlueprintExtractionError("too_many_wall_candidates", {
        count: 4097,
        limit: 4096,
      });
    });
    render(<App />);

    fireEvent.change(screen.getByLabelText("Upload blueprint"), {
      target: {
        files: [
          new File([pngSignature], "blueprint.png", { type: "image/png" }),
        ],
      },
    });

    expect(
      await screen.findByText(
        "Could not extract enough walls, so the sample model is still shown.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("model wall ids")).not.toHaveTextContent(
      "generated-wall",
    );
  });

  it("shows the validation error for an oversized upload", async () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText("Upload blueprint"), {
      target: {
        files: [makeOversizedFile(pngSignature, "image/png")],
      },
    });

    expect(
      await screen.findByText("Upload a PNG, JPG, or PDF blueprint."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Generated perspective from blueprint."),
    ).not.toBeInTheDocument();
  });

  it("ignores stale validation results from an earlier selection", async () => {
    render(<App />);
    const slowValidFile = makeDeferredHeaderFile("image/png");

    fireEvent.change(screen.getByLabelText("Upload blueprint"), {
      target: {
        files: [slowValidFile.file],
      },
    });
    fireEvent.change(screen.getByLabelText("Upload blueprint"), {
      target: {
        files: [
          new File([gifSignature], "blueprint.gif", { type: "image/gif" }),
        ],
      },
    });

    expect(
      await screen.findByText("Upload a PNG, JPG, or PDF blueprint."),
    ).toBeInTheDocument();

    await act(async () => {
      slowValidFile.resolveHeader(pngSignature.buffer.slice(0));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(
      screen.getByText("Upload a PNG, JPG, or PDF blueprint."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Generated perspective from blueprint."),
    ).not.toBeInTheDocument();
  });

  it("ignores stale generation results from an earlier selection", async () => {
    let resolveNormalization: (value: {
      canvas: HTMLCanvasElement;
      height: number;
      width: number;
    }) => void = () => {};
    mocks.normalizeImageFile.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveNormalization = resolve;
      }),
    );
    render(<App />);

    fireEvent.change(screen.getByLabelText("Upload blueprint"), {
      target: {
        files: [
          new File([pngSignature], "blueprint.png", { type: "image/png" }),
        ],
      },
    });
    fireEvent.change(screen.getByLabelText("Upload blueprint"), {
      target: {
        files: [
          new File([gifSignature], "blueprint.gif", { type: "image/gif" }),
        ],
      },
    });

    expect(
      await screen.findByText("Upload a PNG, JPG, or PDF blueprint."),
    ).toBeInTheDocument();

    await act(async () => {
      resolveNormalization({
        canvas: sampleCanvas,
        height: 100,
        width: 100,
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(
      screen.getByText("Upload a PNG, JPG, or PDF blueprint."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Generated perspective from blueprint."),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("model wall ids")).not.toHaveTextContent(
      "generated-wall",
    );
  });
});

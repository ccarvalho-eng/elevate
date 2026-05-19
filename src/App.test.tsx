import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

const pngSignature = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const gifSignature = new Uint8Array([0x47, 0x49, 0x46, 0x38]);

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
  afterEach(cleanup);

  it("renders the upload control and viewer placeholder", () => {
    render(<App />);

    expect(screen.getByLabelText("Upload blueprint")).toBeInTheDocument();
    expect(screen.getByText("3D viewer will render here")).toBeInTheDocument();
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
  });

  it("shows a valid-selection status for a supported upload", async () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText("Upload blueprint"), {
      target: {
        files: [
          new File([pngSignature], "blueprint.png", { type: "image/png" }),
        ],
      },
    });

    expect(await screen.findByText("Blueprint selected.")).toBeInTheDocument();
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
    expect(screen.queryByText("Blueprint selected.")).not.toBeInTheDocument();
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
    expect(screen.queryByText("Blueprint selected.")).not.toBeInTheDocument();
  });
});

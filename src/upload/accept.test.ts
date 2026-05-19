import { afterEach, describe, expect, it, vi } from "vitest";

import { normalizeImageFile } from "../blueprint/normalize";
import { validateBlueprintFile } from "./accept";

class MockImage {
  onerror: (() => void) | null = null;
  onload: (() => void) | null = null;
  src = "";
  width = 800;
  height = 600;
}

const pngSignature = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const jpegSignature = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
const pdfSignature = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
const gifSignature = new Uint8Array([0x47, 0x49, 0x46, 0x38]);

const makeFile = (
  name: string,
  type: string,
  content: BlobPart = pngSignature,
) => new File([content], name, { type });

const makeOversizedFile = (type: string, content: Uint8Array) =>
  ({
    size: 20 * 1024 * 1024 + 1,
    slice: vi.fn(() => ({
      arrayBuffer: vi.fn(async () => content.buffer.slice(0)),
    })),
    type,
  }) as unknown as File;

const stubSuccessfulImageLoad = (imageWidth: number, imageHeight: number) => {
  vi.stubGlobal(
    "Image",
    class {
      onerror: (() => void) | null = null;
      onload: (() => void) | null = null;
      width = imageWidth;
      height = imageHeight;

      set src(_value: string) {
        queueMicrotask(() => this.onload?.());
      }
    },
  );
};

describe("validateBlueprintFile", () => {
  it.each([
    ["image/png", pngSignature, "image"],
    ["image/jpeg", jpegSignature, "image"],
    ["application/pdf", pdfSignature, "pdf"],
  ] as const)(
    "accepts %s uploads as %s blueprints",
    async (type, content, kind) => {
      await expect(
        validateBlueprintFile(makeFile("blueprint", type, content)),
      ).resolves.toEqual({
        ok: true,
        kind,
      });
    },
  );

  it("rejects unsupported blueprint uploads with a user-facing reason", async () => {
    await expect(
      validateBlueprintFile(
        makeFile("blueprint.gif", "image/gif", gifSignature),
      ),
    ).resolves.toEqual({
      ok: false,
      reason: "Upload a PNG, JPG, or PDF blueprint.",
    });
  });

  it("rejects spoofed image MIME types when the content signature is unsupported", async () => {
    await expect(
      validateBlueprintFile(
        makeFile("blueprint.png", "image/png", gifSignature),
      ),
    ).resolves.toEqual({
      ok: false,
      reason: "Upload a PNG, JPG, or PDF blueprint.",
    });
  });

  it.each([
    ["image/png", pdfSignature],
    ["image/jpeg", pngSignature],
    ["application/pdf", jpegSignature],
  ] as const)(
    "rejects supported %s uploads when the content signature does not match",
    async (type, content) => {
      await expect(
        validateBlueprintFile(makeFile("blueprint", type, content)),
      ).resolves.toEqual({
        ok: false,
        reason: "Upload a PNG, JPG, or PDF blueprint.",
      });
    },
  );

  it("accepts valid content signatures when the MIME type is empty", async () => {
    await expect(
      validateBlueprintFile(makeFile("blueprint", "", jpegSignature)),
    ).resolves.toEqual({
      ok: true,
      kind: "image",
    });
  });

  it.each([
    ["image/png", pngSignature],
    ["image/jpeg", jpegSignature],
    ["application/pdf", pdfSignature],
  ] as const)(
    "rejects oversized %s uploads before reading the content signature",
    async (type, content) => {
      const file = makeOversizedFile(type, content);

      await expect(validateBlueprintFile(file)).resolves.toEqual({
        ok: false,
        reason: "Upload a PNG, JPG, or PDF blueprint.",
      });
      expect(file.slice).not.toHaveBeenCalled();
    },
  );
});

describe("normalizeImageFile", () => {
  const imageInstances: MockImage[] = [];

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    imageInstances.length = 0;
  });

  it("loads an image file into a canvas and reports its dimensions", async () => {
    const objectUrl = "blob:blueprint";
    const createObjectURL = vi.fn(() => objectUrl);
    const revokeObjectURL = vi.fn();
    const drawImage = vi.fn();

    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    vi.stubGlobal(
      "Image",
      class extends MockImage {
        constructor() {
          super();
          imageInstances.push(this);
        }
      },
    );
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage,
    } as unknown as CanvasRenderingContext2D);

    const file = makeFile("blueprint.png", "image/png");
    const resultPromise = normalizeImageFile(file);

    expect(imageInstances[0].src).toBe(objectUrl);
    imageInstances[0].onload?.();

    const result = await resultPromise;

    expect(createObjectURL).toHaveBeenCalledWith(file);
    expect(drawImage).toHaveBeenCalledWith(imageInstances[0], 0, 0);
    expect(result.canvas).toBeInstanceOf(HTMLCanvasElement);
    expect(result.width).toBe(800);
    expect(result.height).toBe(600);
    expect(result.canvas.width).toBe(800);
    expect(result.canvas.height).toBe(600);
    expect(revokeObjectURL).toHaveBeenCalledWith(objectUrl);
  });

  it("revokes the object URL and throws a clear error when the image fails to load", async () => {
    const objectUrl = "blob:broken-blueprint";
    const revokeObjectURL = vi.fn();

    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => objectUrl),
      revokeObjectURL,
    });
    vi.stubGlobal(
      "Image",
      class extends MockImage {
        constructor() {
          super();
          imageInstances.push(this);
        }
      },
    );

    const resultPromise = normalizeImageFile(
      makeFile("blueprint.png", "image/png"),
    );

    imageInstances[0].onerror?.();

    await expect(resultPromise).rejects.toThrow(
      "Could not load blueprint image.",
    );
    expect(revokeObjectURL).toHaveBeenCalledWith(objectUrl);
  });

  it("revokes the object URL and throws a clear error when the canvas context is missing", async () => {
    const objectUrl = "blob:contextless-blueprint";
    const revokeObjectURL = vi.fn();

    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => objectUrl),
      revokeObjectURL,
    });
    vi.stubGlobal(
      "Image",
      class extends MockImage {
        constructor() {
          super();
          imageInstances.push(this);
        }
      },
    );
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);

    const resultPromise = normalizeImageFile(
      makeFile("blueprint.png", "image/png"),
    );

    imageInstances[0].onload?.();

    await expect(resultPromise).rejects.toThrow(
      "Could not create canvas context for blueprint image.",
    );
    expect(revokeObjectURL).toHaveBeenCalledWith(objectUrl);
  });

  it("rejects oversized image files before creating an object URL", async () => {
    const createObjectURL = vi.fn(() => "blob:oversized-blueprint");
    const largeContent = new Uint8Array(20 * 1024 * 1024 + 1);

    vi.stubGlobal("URL", {
      createObjectURL,
      revokeObjectURL: vi.fn(),
    });
    stubSuccessfulImageLoad(800, 600);

    await expect(
      normalizeImageFile(makeFile("large.png", "image/png", largeContent)),
    ).rejects.toThrow("Blueprint image exceeds the 20 MB limit.");
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it("rejects decoded images that exceed the pixel limit before canvas allocation", async () => {
    const objectUrl = "blob:huge-blueprint";
    const revokeObjectURL = vi.fn();
    const createElement = vi.spyOn(document, "createElement");

    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => objectUrl),
      revokeObjectURL,
    });
    stubSuccessfulImageLoad(9_000, 9_000);

    await expect(
      normalizeImageFile(makeFile("large.png", "image/png", pngSignature)),
    ).rejects.toThrow("Blueprint image dimensions exceed the supported limit.");
    expect(createElement).not.toHaveBeenCalledWith("canvas");
    expect(revokeObjectURL).toHaveBeenCalledWith(objectUrl);
  });

  it("rejects decoded images that exceed the dimension limit before canvas allocation", async () => {
    const objectUrl = "blob:wide-blueprint";
    const revokeObjectURL = vi.fn();
    const createElement = vi.spyOn(document, "createElement");

    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => objectUrl),
      revokeObjectURL,
    });
    stubSuccessfulImageLoad(16_385, 100);

    await expect(
      normalizeImageFile(makeFile("wide.png", "image/png", pngSignature)),
    ).rejects.toThrow("Blueprint image dimensions exceed the supported limit.");
    expect(createElement).not.toHaveBeenCalledWith("canvas");
    expect(revokeObjectURL).toHaveBeenCalledWith(objectUrl);
  });

  it("rejects zero or invalid decoded image dimensions before canvas allocation", async () => {
    const objectUrl = "blob:invalid-blueprint";
    const revokeObjectURL = vi.fn();
    const createElement = vi.spyOn(document, "createElement");

    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => objectUrl),
      revokeObjectURL,
    });
    stubSuccessfulImageLoad(0, 600);

    await expect(
      normalizeImageFile(makeFile("zero-width.png", "image/png", pngSignature)),
    ).rejects.toThrow("Blueprint image has invalid dimensions.");
    expect(createElement).not.toHaveBeenCalledWith("canvas");
    expect(revokeObjectURL).toHaveBeenCalledWith(objectUrl);
  });
});

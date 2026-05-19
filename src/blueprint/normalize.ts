export type NormalizedImage = {
  canvas: HTMLCanvasElement;
  height: number;
  width: number;
};

const maxImageFileBytes = 20 * 1024 * 1024;
const maxImageDimension = 16_384;
const maxImagePixels = 67_108_864;

const loadImage = async (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load blueprint image."));
    image.src = src;
  });

export const normalizeImageFile = async (
  file: File,
): Promise<NormalizedImage> => {
  if (file.size > maxImageFileBytes) {
    throw new Error("Blueprint image exceeds the 20 MB limit.");
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await loadImage(objectUrl);
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;

    if (
      !Number.isFinite(width) ||
      !Number.isFinite(height) ||
      width <= 0 ||
      height <= 0
    ) {
      throw new Error("Blueprint image has invalid dimensions.");
    }

    if (
      width > maxImageDimension ||
      height > maxImageDimension ||
      width * height > maxImagePixels
    ) {
      throw new Error("Blueprint image dimensions exceed the supported limit.");
    }

    const canvas = document.createElement("canvas");

    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Could not create canvas context for blueprint image.");
    }

    context.drawImage(image, 0, 0);

    return { canvas, width, height };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

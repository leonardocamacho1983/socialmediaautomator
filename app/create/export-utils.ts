import {
  TYPOGRAPHIC_POST_HEIGHT,
  TYPOGRAPHIC_POST_WIDTH,
} from "../../lib/creative/typographic-piece";

export async function downloadSvgAsPng(svg: string, fileName: string) {
  const pngBlob = await svgToPngBlob(svg);
  downloadBlob(pngBlob, fileName);
}

export async function svgToPngBlob(svg: string) {
  const svgBlob = new Blob([svg], {
    type: "image/svg+xml;charset=utf-8",
  });
  const svgUrl = URL.createObjectURL(svgBlob);

  try {
    const image = new Image();
    image.decoding = "async";

    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Image load failed"));
      image.src = svgUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = TYPOGRAPHIC_POST_WIDTH;
    canvas.height = TYPOGRAPHIC_POST_HEIGHT;
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Canvas unavailable");
    }

    context.drawImage(image, 0, 0, TYPOGRAPHIC_POST_WIDTH, TYPOGRAPHIC_POST_HEIGHT);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
          return;
        }

        reject(new Error("PNG export failed"));
      }, "image/png");
    });
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export type ZipDownloadFile = {
  name: string;
  content: Blob | string;
};

export async function downloadZipFile(files: ZipDownloadFile[], fileName: string) {
  const zipBlob = await createZipBlob(files);
  downloadBlob(zipBlob, fileName);
}

async function createZipBlob(files: ZipDownloadFile[]) {
  const localParts: BlobPart[] = [];
  const centralParts: BlobPart[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = new TextEncoder().encode(sanitizeZipPath(file.name));
    const content =
      typeof file.content === "string"
        ? new Blob([file.content], { type: "text/plain;charset=utf-8" })
        : file.content;
    const contentBytes = new Uint8Array(await content.arrayBuffer());
    const crc = crc32(contentBytes);
    const { date, time } = toDosDateTime(new Date());
    const localHeader = new Uint8Array(30);
    const localView = new DataView(localHeader.buffer);

    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, time, true);
    localView.setUint16(12, date, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, contentBytes.length, true);
    localView.setUint32(22, contentBytes.length, true);
    localView.setUint16(26, nameBytes.length, true);
    localView.setUint16(28, 0, true);

    localParts.push(localHeader, nameBytes, contentBytes);

    const centralHeader = new Uint8Array(46);
    const centralView = new DataView(centralHeader.buffer);

    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, time, true);
    centralView.setUint16(14, date, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, contentBytes.length, true);
    centralView.setUint32(24, contentBytes.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, offset, true);

    centralParts.push(centralHeader, nameBytes);
    offset += localHeader.length + nameBytes.length + contentBytes.length;
  }

  const centralDirectorySize = centralParts.reduce(
    (size, part) => size + partSize(part),
    0,
  );
  const endRecord = new Uint8Array(22);
  const endView = new DataView(endRecord.buffer);

  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralDirectorySize, true);
  endView.setUint32(16, offset, true);
  endView.setUint16(20, 0, true);

  return new Blob([...localParts, ...centralParts, endRecord], {
    type: "application/zip",
  });
}

function sanitizeZipPath(value: string) {
  return value
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .split("/")
    .filter(Boolean)
    .map((part) => part.replace(/[^\w.-]+/g, "-"))
    .join("/");
}

function partSize(part: BlobPart) {
  if (typeof part === "string") {
    return new TextEncoder().encode(part).length;
  }

  if (part instanceof Blob) {
    return part.size;
  }

  return part.byteLength;
}

function toDosDateTime(date: Date) {
  return {
    time:
      (date.getHours() << 11) |
      (date.getMinutes() << 5) |
      Math.floor(date.getSeconds() / 2),
    date:
      ((date.getFullYear() - 1980) << 9) |
      ((date.getMonth() + 1) << 5) |
      date.getDate(),
  };
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;

  for (const byte of bytes) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff];
  }

  return (crc ^ 0xffffffff) >>> 0;
}

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let crc = index;

  for (let bit = 0; bit < 8; bit += 1) {
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }

  return crc >>> 0;
});

export function slugify(value: string) {
  return value
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

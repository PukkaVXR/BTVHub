export type ApiNinjaMethod = "GET" | "POST";

export interface ApiNinjaButtonInput {
  title: string;
  method: ApiNinjaMethod;
  url: string;
  contentType?: string;
  body?: string;
  color?: string;
  iconLabel?: string;
  showTitle?: boolean;
  titleColor?: string;
  fontSize?: number;
  backgroundImageDataUrl?: string;
  backgroundFit?: "cover" | "contain" | "stretch";
  backgroundOpacity?: number;
  backgroundPositionX?: number;
  backgroundPositionY?: number;
  imageEffect?: "none" | "glow" | "vignette" | "scanlines" | "glass";
  showArtworkOverlay?: boolean;
  badgeText?: string;
  subtitle?: string;
  textPlacement?: "bottom" | "center" | "top";
}

export function createApiNinjaButton(input: ApiNinjaButtonInput) {
  return {
    version: "1.0",
    requestType: input.method === "POST" ? 1 : 0,
    url: input.url,
    loadURLFromFiles: false,
    urlFile: "",
    contentType: input.contentType ?? (input.method === "POST" ? "application/json" : ""),
    loadFromFiles: false,
    headersFile: "",
    dataFile: "",
    headers: "",
    data: input.body === "{}" ? "" : input.body ?? "",
    responseShown: "",
    autorunMinutes: "0",
    autorunType: 0,
    titlePrefix: "",
    titleSuffix: "",
    responseFormat: "",
    saveResponseToFile: false,
    responseShownFile: null,
    parseResponse: false,
    responseRegex: "",
    responseRegexFetch: "",
    debugLogging: false,
    treatResponseAsText: true,
    treatResponseAsImage: false,
    showCustomImages: false,
    customImageValue: "",
    matchedImage: "",
    unmatchedImage: "",
    responseImageField: "",
    hideSuccessIndicator: false,
  };
}

function createApiNinjaSettings(input: ApiNinjaButtonInput) {
  return createApiNinjaButton(input);
}

export function safeNinjaFileName(value: string): string {
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${cleaned || "btv-action"}.ninja`;
}

export function downloadApiNinjaButton(input: ApiNinjaButtonInput): void {
  const blob = new Blob([JSON.stringify(createApiNinjaButton(input))], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = safeNinjaFileName(input.title);
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function uuid(): string {
  if (crypto.randomUUID) return crypto.randomUUID();
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (char) =>
    (Number(char) ^ (crypto.getRandomValues(new Uint8Array(1))[0]! & (15 >> (Number(char) / 4)))).toString(16),
  );
}

function encodeJson(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value, null, 2));
}

function encodeText(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

const crcTable = new Uint32Array(256);
for (let index = 0; index < 256; index += 1) {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  crcTable[index] = value >>> 0;
}

function crc32(data: Uint8Array): number {
  let value = 0xffffffff;
  for (const byte of data) {
    value = crcTable[(value ^ byte) & 0xff]! ^ (value >>> 8);
  }
  return (value ^ 0xffffffff) >>> 0;
}

function writeU16(target: Uint8Array, offset: number, value: number): void {
  target[offset] = value & 0xff;
  target[offset + 1] = (value >>> 8) & 0xff;
}

function writeU32(target: Uint8Array, offset: number, value: number): void {
  target[offset] = value & 0xff;
  target[offset + 1] = (value >>> 8) & 0xff;
  target[offset + 2] = (value >>> 16) & 0xff;
  target[offset + 3] = (value >>> 24) & 0xff;
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function dosDateTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  return {
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
  };
}

interface ZipEntry {
  name: string;
  data: Uint8Array;
}

function createZip(entries: ZipEntry[]): Uint8Array {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  const { date, time } = dosDateTime();
  let offset = 0;

  for (const entry of entries) {
    const name = encodeText(entry.name);
    const crc = crc32(entry.data);
    const local = new Uint8Array(30 + name.length);
    writeU32(local, 0, 0x04034b50);
    writeU16(local, 4, 20);
    writeU16(local, 6, 0);
    writeU16(local, 8, 0);
    writeU16(local, 10, time);
    writeU16(local, 12, date);
    writeU32(local, 14, crc);
    writeU32(local, 18, entry.data.length);
    writeU32(local, 22, entry.data.length);
    writeU16(local, 26, name.length);
    writeU16(local, 28, 0);
    local.set(name, 30);
    localParts.push(local, entry.data);

    const central = new Uint8Array(46 + name.length);
    writeU32(central, 0, 0x02014b50);
    writeU16(central, 4, 20);
    writeU16(central, 6, 20);
    writeU16(central, 8, 0);
    writeU16(central, 10, 0);
    writeU16(central, 12, time);
    writeU16(central, 14, date);
    writeU32(central, 16, crc);
    writeU32(central, 20, entry.data.length);
    writeU32(central, 24, entry.data.length);
    writeU16(central, 28, name.length);
    writeU16(central, 30, 0);
    writeU16(central, 32, 0);
    writeU16(central, 34, 0);
    writeU16(central, 36, 0);
    writeU32(central, 38, entry.name.endsWith("/") ? 16 : 0);
    writeU32(central, 42, offset);
    central.set(name, 46);
    centralParts.push(central);

    offset += local.length + entry.data.length;
  }

  const centralDirectory = concatBytes(centralParts);
  const end = new Uint8Array(22);
  writeU32(end, 0, 0x06054b50);
  writeU16(end, 8, entries.length);
  writeU16(end, 10, entries.length);
  writeU32(end, 12, centralDirectory.length);
  writeU32(end, 16, offset);
  return concatBytes([...localParts, centralDirectory, end]);
}

function streamDeckPackageFileName(value: string): string {
  return safeNinjaFileName(value).replace(/\.ninja$/, ".streamDeckAction");
}

async function loadImage(src: string): Promise<HTMLImageElement | null> {
  if (!src) return null;
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

function clampPercent(value: number | undefined): number {
  return Math.max(0, Math.min(100, Number.isFinite(value) ? value! : 50));
}

function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
  fit: "cover" | "contain" | "stretch",
  positionX = 50,
  positionY = 50,
) {
  if (fit === "stretch") {
    ctx.drawImage(image, x, y, width, height);
    return;
  }
  const scale = fit === "cover" ? Math.max(width / image.width, height / image.height) : Math.min(width / image.width, height / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  const offsetX = x + (width - drawWidth) * (clampPercent(positionX) / 100);
  const offsetY = y + (height - drawHeight) * (clampPercent(positionY) / 100);
  ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
}

async function createStreamDeckKeyImage(input: ApiNinjaButtonInput): Promise<Uint8Array> {
  const canvas = document.createElement("canvas");
  canvas.width = 288;
  canvas.height = 288;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new Uint8Array();

  const color = input.color || "#5b8cff";
  const effect = input.imageEffect ?? "glass";
  const showArtworkOverlay = input.showArtworkOverlay ?? true;
  ctx.fillStyle = "#090d14";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const gradient = ctx.createLinearGradient(0, 0, 288, 288);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, "#101724");
  ctx.fillStyle = gradient;
  ctx.fillRect(12, 12, 264, 264);

  const backgroundImage = await loadImage(input.backgroundImageDataUrl ?? "");
  if (backgroundImage) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, input.backgroundOpacity ?? 0.72));
    drawCoverImage(ctx, backgroundImage, 12, 12, 264, 264, input.backgroundFit ?? "cover", input.backgroundPositionX, input.backgroundPositionY);
    ctx.restore();
  }

  if (showArtworkOverlay && effect === "glow") {
    ctx.shadowColor = color;
    ctx.shadowBlur = 38;
    ctx.strokeStyle = color;
    ctx.lineWidth = 6;
    ctx.strokeRect(16, 16, 256, 256);
    ctx.shadowBlur = 0;
  }

  if (showArtworkOverlay && (effect === "vignette" || effect === "glass")) {
    const vignette = ctx.createRadialGradient(144, 122, 36, 144, 144, 178);
    vignette.addColorStop(0, "rgba(255,255,255,0.04)");
    vignette.addColorStop(1, "rgba(0,0,0,0.72)");
    ctx.fillStyle = vignette;
    ctx.fillRect(12, 12, 264, 264);
  }

  if (showArtworkOverlay && effect === "scanlines") {
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    for (let y = 18; y < 276; y += 8) ctx.fillRect(12, y, 264, 2);
  }

  if (!showArtworkOverlay) {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) return new Uint8Array();
    return new Uint8Array(await blob.arrayBuffer());
  }

  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fillRect(12, 12, 264, 72);
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  const placement = input.textPlacement ?? "bottom";
  const panelY = placement === "top" ? 26 : placement === "center" ? 95 : 136;
  ctx.fillRect(28, panelY, 232, placement === "bottom" ? 108 : 104);

  if (input.badgeText) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(190, 28, 70, 34, 12);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 16px Inter, Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(input.badgeText, 225, 45, 58);
  }

  const iconY = placement === "top" ? 154 : placement === "center" ? 64 : 72;
  const iconLabel = input.iconLabel?.trim() ?? "";
  if (iconLabel) {
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 46px Inter, Arial, sans-serif";
    ctx.fillText(iconLabel, 144, iconY, 210);
  }

  const firstLineY = placement === "top" ? 70 : placement === "center" ? 136 : 172;
  const title = input.title.trim();
  const words = title.split(/\s+/).filter(Boolean);
  const lines = words.length > 2 ? [words.slice(0, -1).join(" "), words.at(-1)!] : title ? [title] : [];
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 28px Inter, Arial, sans-serif";
  lines.slice(0, 2).forEach((line, index) => ctx.fillText(line, 144, firstLineY + index * 34, 220));
  if (input.subtitle) {
    ctx.fillStyle = "rgba(255,255,255,0.78)";
    ctx.font = "bold 17px Inter, Arial, sans-serif";
    ctx.fillText(input.subtitle, 144, firstLineY + Math.min(lines.length, 2) * 34 + 12, 210);
  }

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) return new Uint8Array();
  return new Uint8Array(await blob.arrayBuffer());
}

export async function downloadStreamDeckAction(input: ApiNinjaButtonInput): Promise<void> {
  const profileId = uuid();
  const defaultPageId = uuid();
  const actionPageId = uuid();
  const actionId = uuid();
  const deviceId = uuid();
  const profileRoot = `Profiles/${profileId.toUpperCase()}.sdProfile`;
  const defaultPageRoot = `${profileRoot}/Profiles/${defaultPageId.toUpperCase()}`;
  const actionPageRoot = `${profileRoot}/Profiles/${actionPageId.toUpperCase()}`;
  const imageData = await createStreamDeckKeyImage(input);
  const imagePath = "Images/btv-action.png";

  const actionState = {
    Title: input.title,
    Image: imagePath,
    FontFamily: "",
    FontSize: input.fontSize ?? 11,
    FontStyle: "",
    FontUnderline: false,
    OutlineThickness: 2,
    ShowTitle: input.showTitle ?? true,
    TitleAlignment: "middle",
    TitleColor: input.titleColor ?? "#ffffff",
  };

  const actionManifest = {
    $uuid: actionPageId,
    Controllers: [
      {
        Actions: {
          "0,0": {
            ActionID: actionId,
            LinkedTitle: false,
            Name: "API Ninja",
            Plugin: {
              Name: "API Ninja",
              UUID: "com.barraider.apininja",
              Version: "1.5",
            },
            Resources: null,
            Settings: createApiNinjaSettings(input),
            State: 0,
            States: [actionState],
            UUID: "com.barraider.apininja",
          },
        },
        Type: "Keypad",
      },
      { Actions: null, Type: "Encoder" },
      { Actions: null, Type: "Neo" },
    ],
    Icon: "",
    Name: "",
  };

  const entries: ZipEntry[] = [
    {
      name: "package.json",
      data: encodeJson({
        AppVersion: "7.4.2.22730",
        DeviceModel: "Fake/Storage",
        DeviceSettings: null,
        FormatVersion: 1,
        OSType: "Windows",
        OSVersion: "10.0.26200",
        RequiredPlugins: ["com.barraider.apininja"],
      }),
    },
    { name: "Profiles/", data: new Uint8Array() },
    { name: `${profileRoot}/`, data: new Uint8Array() },
    {
      name: `${profileRoot}/manifest.json`,
      data: encodeJson({
        Device: { Model: "Fake/Storage", UUID: deviceId },
        Name: "BTV API Ninja Action",
        Pages: {
          Current: "00000000-0000-0000-0000-000000000000",
          Default: defaultPageId,
          Pages: [actionPageId],
        },
        Version: "3.0",
      }),
    },
    { name: `${profileRoot}/Profiles/`, data: new Uint8Array() },
    { name: `${defaultPageRoot}/`, data: new Uint8Array() },
    { name: `${defaultPageRoot}/Images/`, data: new Uint8Array() },
    {
      name: `${defaultPageRoot}/manifest.json`,
      data: encodeJson({
        Controllers: [
          { Actions: null, Type: "Keypad" },
          { Actions: null, Type: "Encoder" },
          { Actions: null, Type: "Neo" },
        ],
        Icon: "",
        Name: "",
      }),
    },
    { name: `${actionPageRoot}/`, data: new Uint8Array() },
    { name: `${actionPageRoot}/Images/`, data: new Uint8Array() },
    { name: `${actionPageRoot}/${imagePath}`, data: imageData },
    { name: `${actionPageRoot}/manifest.json`, data: encodeJson(actionManifest) },
  ];

  const zip = createZip(entries);
  const blob = new Blob([toArrayBuffer(zip)], { type: "application/zip" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = streamDeckPackageFileName(input.title);
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

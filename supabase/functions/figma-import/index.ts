import {
  figmaGet,
  getFigmaToken,
  handleOptions,
  json,
  parseFigmaUrl,
  serviceClient,
} from "../_shared/figma.ts";

/** Import a Figma frame: render it to PNG (the template background) and walk
 * its node tree to suggest TemplateFields for the builder overlay. Component
 * instances, masks, and complex effects may not map cleanly — anything
 * suspicious lands in `warnings` and the admin confirms every suggestion.
 * The manual PNG path never depends on this function. */

interface FigmaNode {
  id: string;
  name: string;
  type: string;
  visible?: boolean;
  characters?: string;
  absoluteBoundingBox?: { x: number; y: number; width: number; height: number };
  style?: {
    fontFamily?: string;
    fontSize?: number;
    textAlignHorizontal?: string;
    textCase?: string;
    letterSpacing?: number;
    lineHeightPercentFontSize?: number;
  };
  fills?: Array<{ type: string; visible?: boolean }>;
  children?: FigmaNode[];
}

interface SuggestedField {
  id: string;
  label: string;
  fieldKey: string;
  type: "text" | "multiline" | "image";
  x: number;
  y: number;
  width: number;
  height: number;
  fontFamily?: string;
  fontSizePx?: number;
  align?: "left" | "center" | "right";
  uppercase?: boolean;
  placeholder?: string;
  autoFit?: boolean;
  objectFit?: "cover";
}

const ALIGN: Record<string, "left" | "center" | "right"> = {
  LEFT: "left",
  CENTER: "center",
  RIGHT: "right",
  JUSTIFIED: "left",
};

function slug(name: string, taken: Set<string>): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "field";
  let key = base;
  let n = 2;
  while (taken.has(key)) key = `${base}_${n++}`;
  taken.add(key);
  return key;
}

function walk(
  node: FigmaNode,
  frame: { x: number; y: number; width: number; height: number },
  out: SuggestedField[],
  warnings: string[],
  taken: Set<string>,
  seenIds: Set<string>,
): void {
  if (node.visible === false) return;
  if (seenIds.has(node.id)) {
    warnings.push(`Duplicate node id ${node.id} (component instance?) — skipped a copy.`);
    return;
  }
  seenIds.add(node.id);
  const box = node.absoluteBoundingBox;

  if (box && node.type === "TEXT") {
    const isMultiline = (node.characters ?? "").includes("\n") || box.height > (node.style?.fontSize ?? 16) * 2.2;
    out.push({
      id: crypto.randomUUID(),
      label: node.name,
      fieldKey: slug(node.name, taken),
      type: isMultiline ? "multiline" : "text",
      x: Math.round(box.x - frame.x),
      y: Math.round(box.y - frame.y),
      width: Math.round(box.width),
      height: Math.round(box.height),
      fontFamily: node.style?.fontFamily,
      fontSizePx: node.style?.fontSize,
      align: ALIGN[node.style?.textAlignHorizontal ?? ""] ?? "left",
      uppercase: node.style?.textCase === "UPPER" || undefined,
      placeholder: node.characters?.slice(0, 80),
      autoFit: true,
    });
    return;
  }

  const hasImageFill = node.fills?.some((f) => f.type === "IMAGE" && f.visible !== false) ?? false;
  if (box && hasImageFill && (node.type === "RECTANGLE" || node.type === "FRAME" || node.type === "ELLIPSE")) {
    out.push({
      id: crypto.randomUUID(),
      label: node.name,
      fieldKey: slug(node.name, taken),
      type: "image",
      x: Math.round(box.x - frame.x),
      y: Math.round(box.y - frame.y),
      width: Math.round(box.width),
      height: Math.round(box.height),
      objectFit: "cover",
    });
    return;
  }

  for (const child of node.children ?? []) walk(child, frame, out, warnings, taken, seenIds);
}

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  try {
    const { companyId, url } = (await req.json()) as { companyId?: string; url?: string };
    if (!companyId || !url) return json({ error: "companyId and url required" }, 400);

    const parsed = parseFigmaUrl(url);
    if (!parsed) {
      return json({ error: "Could not read that link — copy a frame link (with node-id) from Figma." }, 400);
    }

    const db = serviceClient();
    const token = await getFigmaToken(db, companyId);
    if (!token) return json({ error: "Figma is not connected for this company." }, 400);

    // 1. Node subtree.
    const nodesRes = await figmaGet(
      `/v1/files/${parsed.fileKey}/nodes?ids=${encodeURIComponent(parsed.nodeId)}&geometry=paths`,
      token,
    );
    if (!nodesRes.ok) return json({ error: `Figma nodes request failed (${nodesRes.status}).` }, 400);
    const nodesBody = (await nodesRes.json()) as {
      nodes: Record<string, { document: FigmaNode } | null>;
    };
    const root = nodesBody.nodes[parsed.nodeId]?.document;
    if (!root?.absoluteBoundingBox) {
      return json({ error: "That node has no renderable bounds — pick a frame." }, 400);
    }
    const frame = root.absoluteBoundingBox;

    // 2. Render the frame to PNG and re-host it in our Storage (Figma's
    //    render URLs expire after ~14 days).
    const imgRes = await figmaGet(
      `/v1/images/${parsed.fileKey}?ids=${encodeURIComponent(parsed.nodeId)}&format=png&scale=2`,
      token,
    );
    if (!imgRes.ok) return json({ error: `Figma render failed (${imgRes.status}).` }, 400);
    const imgBody = (await imgRes.json()) as { images: Record<string, string | null> };
    const renderUrl = imgBody.images[parsed.nodeId];
    if (!renderUrl) return json({ error: "Figma could not render that frame." }, 400);
    const png = await (await fetch(renderUrl)).arrayBuffer();

    const path = `${companyId}/figma-${Date.now()}.png`;
    const upload = await db.storage
      .from("template-backgrounds")
      .upload(path, png, { contentType: "image/png" });
    if (upload.error) return json({ error: `Storage upload failed: ${upload.error.message}` }, 500);
    const backgroundUrl = db.storage.from("template-backgrounds").getPublicUrl(path).data.publicUrl;

    // 3. Suggested fields from the tree, coordinates relative to the frame.
    const suggestedFields: SuggestedField[] = [];
    const warnings: string[] = [];
    const taken = new Set<string>();
    const seenIds = new Set<string>();
    try {
      for (const child of root.children ?? []) walk(child, frame, suggestedFields, warnings, taken, seenIds);
    } catch (e) {
      warnings.push(`Field detection stopped early (${String(e)}) — background imported; map fields manually.`);
    }
    if (!suggestedFields.length) {
      warnings.push("No text or image layers detected — draw fields manually on the imported background.");
    }

    return json({
      backgroundUrl,
      canvasWidth: Math.round(frame.width),
      canvasHeight: Math.round(frame.height),
      suggestedFields,
      warnings,
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

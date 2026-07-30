/** Classify a media MIME type for rendering. */
export function mediaKind(mimeType: string): "image" | "video" {
  return mimeType.startsWith("video/") ? "video" : "image";
}

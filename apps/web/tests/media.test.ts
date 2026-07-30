import { describe, expect, it } from "vitest";
import { mediaKind } from "../src/lib/media";

describe("mediaKind", () => {
  it('returns "video" for video mime types', () => {
    expect(mediaKind("video/mp4")).toBe("video");
    expect(mediaKind("video/quicktime")).toBe("video");
  });

  it('returns "image" for image mime types', () => {
    expect(mediaKind("image/png")).toBe("image");
    expect(mediaKind("image/webp")).toBe("image");
  });

  it('returns "image" for unknown mime types', () => {
    expect(mediaKind("application/pdf")).toBe("image");
  });
});

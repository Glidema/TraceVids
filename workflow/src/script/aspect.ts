export type AspectRatio = "16:9" | "9:16" | "1:1";

export const ASPECT_PRESETS: Record<
	AspectRatio,
	{ width: number; height: number; label: string }
> = {
	"16:9": { width: 1280, height: 720, label: "横屏 16:9" },
	"9:16": { width: 720, height: 1280, label: "竖屏 9:16" },
	"1:1": { width: 1080, height: 1080, label: "方形 1:1" },
};

export function resolveAspect(aspect?: string): AspectRatio {
	if (aspect === "9:16" || aspect === "1:1" || aspect === "16:9") return aspect;
	return "16:9";
}

export function viewportForAspect(aspect?: string) {
	return ASPECT_PRESETS[resolveAspect(aspect)];
}

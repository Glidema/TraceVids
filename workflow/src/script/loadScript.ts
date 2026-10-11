import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import type { DemoScript, DemoStep } from "./types.js";

const ACTIONS = new Set([
	"goto",
	"wait",
	"click",
	"hover",
	"type",
	"press",
	"scroll",
	"upload",
	"assert",
]);

function asStep(raw: unknown, index: number): DemoStep {
	if (!raw || typeof raw !== "object") {
		throw new Error(`steps[${index}] must be an object`);
	}
	const step = raw as Record<string, unknown>;
	const action = step.action;
	if (typeof action !== "string" || !ACTIONS.has(action)) {
		throw new Error(`steps[${index}].action invalid: ${String(action)}`);
	}
	return step as DemoStep;
}

export function parseDemoScript(raw: unknown, baseDir: string): DemoScript {
	if (!raw || typeof raw !== "object") throw new Error("script root must be an object");
	const doc = raw as Record<string, unknown>;
	if (typeof doc.url !== "string" || !doc.url) throw new Error("script.url is required");
	if (!Array.isArray(doc.steps) || doc.steps.length === 0) {
		throw new Error("script.steps must be a non-empty array");
	}

	const steps = doc.steps.map(asStep).map((step) => {
		if (step.action === "upload") {
			const p = step.path.startsWith("/") ? step.path : path.resolve(baseDir, step.path);
			return { ...step, path: p };
		}
		return step;
	});

	const captions = Array.isArray(doc.captions)
		? doc.captions
				.filter(
					(c): c is { atStep: number; text: string } =>
						Boolean(c) &&
						typeof c === "object" &&
						typeof (c as { atStep?: unknown }).atStep === "number" &&
						typeof (c as { text?: unknown }).text === "string",
				)
				.map((c) => ({ atStep: c.atStep, text: c.text }))
		: undefined;

	const aspectRatio =
		doc.aspectRatio === "9:16" || doc.aspectRatio === "1:1" || doc.aspectRatio === "16:9"
			? doc.aspectRatio
			: undefined;

	return {
		name: typeof doc.name === "string" ? doc.name : undefined,
		url: doc.url,
		title: typeof doc.title === "string" ? doc.title : undefined,
		subtitle: typeof doc.subtitle === "string" ? doc.subtitle : undefined,
		locale: typeof doc.locale === "string" ? doc.locale : undefined,
		aspectRatio,
		voiceover: typeof doc.voiceover === "boolean" ? doc.voiceover : undefined,
		narration: typeof doc.narration === "string" ? doc.narration : undefined,
		brandColor: typeof doc.brandColor === "string" ? doc.brandColor : undefined,
		captions,
		viewport:
			doc.viewport && typeof doc.viewport === "object"
				? {
						width: Number((doc.viewport as { width?: number }).width ?? 1280),
						height: Number((doc.viewport as { height?: number }).height ?? 720),
					}
				: { width: 1280, height: 720 },
		steps,
	};
}

export async function loadDemoScript(filePath: string): Promise<DemoScript> {
	const abs = path.resolve(filePath);
	const text = await readFile(abs, "utf8");
	const raw = abs.endsWith(".json") ? JSON.parse(text) : parseYaml(text);
	return parseDemoScript(raw, path.dirname(abs));
}

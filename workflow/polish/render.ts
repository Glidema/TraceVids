/**
 * Polish a recorded demo folder with Remotion.
 *
 *   npx tsx render.ts ../output/transcribe-mp3
 */

import { access, copyFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { parseMedia } from "@remotion/media-parser";
import { nodeReader } from "@remotion/media-parser/node";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { OUTRO_FRAMES, TITLE_FRAMES, type PolishCaption } from "./src/DemoPolish";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FPS = 30;

async function localChrome(): Promise<string | undefined> {
	const candidate = path.join(
		HERE,
		"node_modules/.remotion/chrome-headless-shell/mac-arm64/chrome-headless-shell-mac-arm64/chrome-headless-shell",
	);
	try {
		await access(candidate);
		return candidate;
	} catch {
		return undefined;
	}
}

const ASPECT_SIZE: Record<string, { width: number; height: number }> = {
	"16:9": { width: 1280, height: 720 },
	"9:16": { width: 720, height: 1280 },
	"1:1": { width: 1080, height: 1080 },
};

type Meta = {
	title?: string;
	subtitle?: string;
	brandColor?: string;
	aspectRatio?: string;
	voiceoverFile?: string | null;
	captions?: Array<{ atStep: number; text: string }>;
	events?: Array<{ tMs: number; action: string; label?: string; x?: number; y?: number }>;
	viewport?: { width?: number; height?: number };
	video?: string;
};

function resolveCaptions(meta: Meta): PolishCaption[] {
	const events = meta.events ?? [];
	const authored = meta.captions ?? [];
	if (authored.length > 0) {
		return authored.map((c) => {
			const ev = events[Math.min(c.atStep, Math.max(0, events.length - 1))];
			return {
				tMs: ev?.tMs ?? c.atStep * 1200,
				text: c.text,
				durationMs: 2200,
			};
		});
	}

	return events
		.filter((e) => e.action === "click" || e.action === "upload" || e.action === "hover")
		.slice(0, 8)
		.map((e) => ({
			tMs: e.tMs,
			text: (e.label || e.action).replace(/^.*\//, "").slice(0, 48),
			durationMs: 2000,
		}));
}

async function main() {
	const inputDir = path.resolve(process.argv[2] ?? "../output/transcribe-mp3");
	const videoPath = path.join(inputDir, "demo.webm");
	const metaPath = path.join(inputDir, "meta.json");
	const outPath = path.join(inputDir, "demo-polished.mp4");

	const meta: Meta = JSON.parse(await readFile(metaPath, "utf8"));
	const publicDir = path.join(HERE, "public");
	await mkdir(publicDir, { recursive: true });
	await copyFile(videoPath, path.join(publicDir, "input.webm"));

	let voiceoverFile: string | null = null;
	if (meta.voiceoverFile) {
		const src = path.join(inputDir, meta.voiceoverFile);
		await copyFile(src, path.join(publicDir, meta.voiceoverFile));
		voiceoverFile = meta.voiceoverFile;
	}

	const probed = await parseMedia({
		src: path.join(publicDir, "input.webm"),
		reader: nodeReader,
		acknowledgeRemotionLicense: true,
		fields: { durationInSeconds: true },
	});
	const durationSec = probed.durationInSeconds ?? 0;
	if (!(durationSec > 0)) {
		throw new Error("Could not probe source video duration");
	}
	const sourceFrames = Math.max(1, Math.ceil(durationSec * FPS));
	const captions = resolveCaptions(meta);
	const size =
		ASPECT_SIZE[meta.aspectRatio || "16:9"] ||
		(meta.viewport?.width && meta.viewport?.height
			? { width: meta.viewport.width, height: meta.viewport.height }
			: ASPECT_SIZE["16:9"]);

	console.log(`[polish] source=${videoPath}`);
	console.log(`[polish] duration=${durationSec.toFixed(2)}s → ${sourceFrames} frames`);
	console.log(
		`[polish] aspect=${meta.aspectRatio || "16:9"} ${size.width}x${size.height} captions=${captions.length} voiceover=${voiceoverFile || "none"}`,
	);

	const bundled = await bundle({
		entryPoint: path.join(HERE, "src/index.ts"),
		publicDir,
		webpackOverride: (config) => config,
	});

	const inputProps = {
		videoFile: "input.webm",
		title: meta.title ?? "Product demo",
		subtitle: meta.subtitle ?? "",
		brandColor: meta.brandColor ?? "#ff6b3d",
		events: meta.events ?? [],
		captions,
		sourceFrames,
		voiceoverFile,
	};

	const browserExecutable = await localChrome();
	if (browserExecutable) console.log(`[polish] browser=${browserExecutable}`);

	const composition = await selectComposition({
		serveUrl: bundled,
		id: "DemoPolish",
		inputProps,
		browserExecutable,
	});

	composition.durationInFrames = TITLE_FRAMES + sourceFrames + OUTRO_FRAMES;
	composition.width = size.width;
	composition.height = size.height;

	await renderMedia({
		composition,
		serveUrl: bundled,
		codec: "h264",
		outputLocation: outPath,
		inputProps,
		browserExecutable,
	});

	console.log(`[polish] wrote ${outPath}`);
}

main().catch((err) => {
	console.error(err instanceof Error ? err.message : err);
	process.exit(1);
});

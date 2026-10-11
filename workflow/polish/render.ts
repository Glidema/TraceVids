/**
 * Polish a recorded demo folder with Remotion.
 *
 *   npx tsx render.ts ../output/transcribe-mp3
 */

import { copyFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { parseMedia } from "@remotion/media-parser";
import { nodeReader } from "@remotion/media-parser/node";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { OUTRO_FRAMES, TITLE_FRAMES } from "./src/DemoPolish";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FPS = 30;

type Meta = {
	title?: string;
	subtitle?: string;
	events?: Array<{ tMs: number; action: string; label?: string; x?: number; y?: number }>;
	video?: string;
};

async function main() {
	const inputDir = path.resolve(process.argv[2] ?? "../output/transcribe-mp3");
	const videoName = "demo.webm";
	const videoPath = path.join(inputDir, videoName);
	const metaPath = path.join(inputDir, "meta.json");
	const outPath = path.join(inputDir, "demo-polished.mp4");

	const meta: Meta = JSON.parse(await readFile(metaPath, "utf8"));
	const publicDir = path.join(HERE, "public");
	await mkdir(publicDir, { recursive: true });
	await copyFile(videoPath, path.join(publicDir, "input.webm"));

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

	console.log(`[polish] source=${videoPath}`);
	console.log(`[polish] duration=${durationSec.toFixed(2)}s → ${sourceFrames} frames`);

	const bundled = await bundle({
		entryPoint: path.join(HERE, "src/index.ts"),
		publicDir,
		webpackOverride: (config) => config,
	});

	const inputProps = {
		videoFile: "input.webm",
		title: meta.title ?? "Product demo",
		subtitle: meta.subtitle ?? "",
		events: meta.events ?? [],
		sourceFrames,
	};

	const composition = await selectComposition({
		serveUrl: bundled,
		id: "DemoPolish",
		inputProps,
	});

	// Force duration from probed media (calculateMetadata can be flaky offline).
	composition.durationInFrames = TITLE_FRAMES + sourceFrames + OUTRO_FRAMES;

	await renderMedia({
		composition,
		serveUrl: bundled,
		codec: "h264",
		outputLocation: outPath,
		inputProps,
	});

	console.log(`[polish] wrote ${outPath}`);
}

main().catch((err) => {
	console.error(err instanceof Error ? err.message : err);
	process.exit(1);
});

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { synthesizeNarration } from "../src/tts.js";

async function main() {
	const outDir = path.resolve("output/transcribe-mp3");
	const metaPath = path.join(outDir, "meta.json");
	const meta = JSON.parse(await readFile(metaPath, "utf8")) as Record<string, unknown>;
	const tts = await synthesizeNarration({
		outDir,
		enabled: true,
		title: String(meta.title || ""),
		subtitle: String(meta.subtitle || ""),
		captions: (meta.captions as Array<{ text: string }>) || [],
	});
	meta.voiceoverFile = tts.audioPath ? path.basename(tts.audioPath) : null;
	meta.ttsMode = tts.mode;
	meta.aspectRatio = meta.aspectRatio || "16:9";
	await writeFile(metaPath, JSON.stringify(meta, null, 2));
	console.log(
		JSON.stringify(
			{ mode: tts.mode, file: meta.voiceoverFile, text: tts.text.slice(0, 100) },
			null,
			2,
		),
	);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});

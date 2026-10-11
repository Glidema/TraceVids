/**
 * URL → browser demo video via Playwright recordVideo.
 *
 * Usage:
 *   npm run record -- --script scripts/formats-to-mp3.yaml
 *   npm run record -- https://example.com
 *   npm run record -- https://example.com --out ./out/demo --headed
 */

import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { loadDemoScript } from "./script/loadScript.js";
import { runDemoScript } from "./script/runScript.js";
import type { DemoScript, ScriptEvent } from "./script/types.js";

function parseArgs(argv: string[]) {
	const args = argv.slice(2);
	let url: string | undefined;
	let outDir = path.resolve("output", `demo-${Date.now()}`);
	let headed = false;
	let scriptPath: string | undefined;

	for (let i = 0; i < args.length; i++) {
		const a = args[i];
		if (a === "--out" || a === "-o") {
			const next = args[++i];
			if (!next) throw new Error("--out requires a path");
			outDir = path.resolve(next);
		} else if (a === "--script" || a === "-s") {
			const next = args[++i];
			if (!next) throw new Error("--script requires a path");
			scriptPath = path.resolve(next);
		} else if (a === "--headed") {
			headed = true;
		} else if (a === "--help" || a === "-h") {
			console.log(`Usage:
  npm run record -- --script scripts/formats-to-mp3.yaml [--out <dir>]
  npm run record -- <url> [--out <dir>] [--headed]

--script runs an Agent/human YAML step script (preferred).
Without --script, records a short default tour of <url>.
`);
			process.exit(0);
		} else if (!a.startsWith("-")) {
			url = a;
		}
	}

	return { url, outDir, headed, scriptPath };
}

async function runDefaultTour(page: import("playwright").Page, targetUrl: string): Promise<ScriptEvent[]> {
	const script: DemoScript = {
		url: targetUrl,
		title: new URL(targetUrl).hostname,
		steps: [
			{ action: "goto", waitUntil: "domcontentloaded" },
			{ action: "wait", ms: 1200 },
			{ action: "scroll", y: 500 },
			{ action: "wait", ms: 800 },
			{ action: "scroll", y: 500 },
			{ action: "wait", ms: 800 },
		],
	};
	return runDemoScript(page, script);
}

async function main() {
	const { url, outDir, headed, scriptPath } = parseArgs(process.argv);

	let script: DemoScript | undefined;
	if (scriptPath) {
		script = await loadDemoScript(scriptPath);
	} else if (url) {
		try {
			new URL(url);
		} catch {
			throw new Error(`Invalid URL: ${url}`);
		}
	} else {
		throw new Error("Provide --script <file> or a URL");
	}

	const targetUrl = script?.url ?? url!;
	const viewport = script?.viewport ?? { width: 1280, height: 720 };
	const videoDir = path.join(outDir, ".pw-video");
	await mkdir(videoDir, { recursive: true });

	console.log(`[demo-workflow] url=${targetUrl}`);
	console.log(`[demo-workflow] mode=${scriptPath ? `script:${scriptPath}` : "default-tour"}`);
	console.log(`[demo-workflow] out=${outDir}`);

	let browser;
	try {
		browser = await chromium.launch({ headless: !headed, channel: "chrome" });
		console.log("[demo-workflow] browser=system Chrome");
	} catch {
		browser = await chromium.launch({ headless: !headed });
		console.log("[demo-workflow] browser=Playwright Chromium");
	}

	const context = await browser.newContext({
		viewport,
		locale: script?.locale ?? "zh-CN",
		recordVideo: { dir: videoDir, size: viewport },
	});

	const page = await context.newPage();
	let events: ScriptEvent[] = [];
	let error: unknown;
	try {
		events = script ? await runDemoScript(page, script) : await runDefaultTour(page, targetUrl);
	} catch (e) {
		error = e;
		console.error("[demo-workflow] tour error:", e);
	}

	const pageVideo = page.video();
	await page.close();
	await context.close();
	await browser.close();

	if (!pageVideo) throw new Error("Playwright did not attach a video to the page");

	const rawPath = await pageVideo.path();
	const finalPath = path.join(outDir, "demo.webm");
	await rename(rawPath, finalPath);

	const meta = {
		url: targetUrl,
		title: script?.title ?? new URL(targetUrl).hostname,
		subtitle: script?.subtitle ?? "",
		brandColor: script?.brandColor ?? "#ff6b3d",
		captions: script?.captions ?? [],
		viewport,
		video: "demo.webm",
		script: scriptPath ?? null,
		recordedAt: new Date().toISOString(),
		events,
	};
	await writeFile(path.join(outDir, "meta.json"), JSON.stringify(meta, null, 2));

	console.log(`[demo-workflow] wrote ${finalPath}`);
	console.log(`[demo-workflow] wrote ${path.join(outDir, "meta.json")} (${events.length} events)`);
	if (error) process.exitCode = 1;
}

main().catch((err) => {
	console.error(err instanceof Error ? err.message : err);
	process.exit(1);
});

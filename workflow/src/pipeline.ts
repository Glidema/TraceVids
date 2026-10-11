import { spawn } from "node:child_process";
import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { stringify as toYaml } from "yaml";
import { generateDemoScript } from "./script/generateScript.js";
import { loadDemoScript } from "./script/loadScript.js";
import { collectPageContext } from "./script/pageContext.js";
import { runDemoScript } from "./script/runScript.js";
import type { GeneratedDemoScript } from "./script/schema.js";
import type { DemoScript } from "./script/types.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const WORKFLOW_ROOT = path.resolve(HERE, "..");

export type JobPhase = "queued" | "recording" | "polishing" | "done" | "error";

export interface JobState {
	id: string;
	phase: JobPhase;
	message: string;
	outDir: string;
	scriptPath?: string;
	videoPath?: string;
	error?: string;
	createdAt: string;
	updatedAt: string;
}

function run(cmd: string, args: string[], cwd: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const child = spawn(cmd, args, { cwd, stdio: "inherit", shell: process.platform === "win32" });
		child.on("exit", (code) => {
			if (code === 0) resolve();
			else reject(new Error(`${cmd} ${args.join(" ")} exited ${code}`));
		});
	});
}

export async function generateScriptForUrl(url: string, goal: string) {
	const context = await collectPageContext(url);
	const { script, mode } = await generateDemoScript({ url, goal, context });
	return { script, mode, context };
}

export async function recordFromScript(
	script: DemoScript,
	outDir: string,
): Promise<{ videoPath: string; metaPath: string }> {
	await mkdir(outDir, { recursive: true });
	const videoDir = path.join(outDir, ".pw-video");
	await mkdir(videoDir, { recursive: true });

	const viewport = script.viewport ?? { width: 1280, height: 720 };
	let browser;
	try {
		browser = await chromium.launch({ headless: true, channel: "chrome" });
	} catch {
		browser = await chromium.launch({ headless: true });
	}

	const context = await browser.newContext({
		viewport,
		locale: script.locale ?? "zh-CN",
		recordVideo: { dir: videoDir, size: viewport },
	});

	const page = await context.newPage();
	let events: Awaited<ReturnType<typeof runDemoScript>> = [];
	try {
		events = await runDemoScript(page, script);
	} catch (err) {
		console.warn("[pipeline] script run error:", err);
	}

	const pageVideo = page.video();
	await page.close();
	await context.close();
	await browser.close();

	if (!pageVideo) throw new Error("Playwright did not attach a video");
	const rawPath = await pageVideo.path();
	const videoPath = path.join(outDir, "demo.webm");
	await rename(rawPath, videoPath);

	const meta = {
		url: script.url,
		title: script.title ?? new URL(script.url).hostname,
		subtitle: script.subtitle ?? "",
		brandColor: script.brandColor ?? "#ff6b3d",
		captions: script.captions ?? [],
		viewport,
		video: "demo.webm",
		recordedAt: new Date().toISOString(),
		events,
	};
	const metaPath = path.join(outDir, "meta.json");
	await writeFile(metaPath, JSON.stringify(meta, null, 2));
	return { videoPath, metaPath };
}

export async function polishJob(outDir: string) {
	await run("npx", ["tsx", "render.ts", outDir], path.join(WORKFLOW_ROOT, "polish"));
	return path.join(outDir, "demo-polished.mp4");
}

export async function saveScriptYaml(script: GeneratedDemoScript | DemoScript, filePath: string) {
	await mkdir(path.dirname(filePath), { recursive: true });
	await writeFile(filePath, toYaml(script), "utf8");
}

function absolutizeUploads(script: DemoScript): DemoScript {
	return {
		...script,
		steps: script.steps.map((step) => {
			if (step.action !== "upload") return step;
			if (path.isAbsolute(step.path)) return step;
			// Common agent/scout relative path → workflow/fixtures
			const baseName = path.basename(step.path);
			const fixturePath = path.join(WORKFLOW_ROOT, "fixtures", baseName);
			return { ...step, path: fixturePath };
		}),
	};
}

export async function produceFromScript(
	script: DemoScript,
	outDir: string,
	onPhase?: (phase: JobPhase, message: string) => void,
) {
	const scriptPath = path.join(outDir, "script.yaml");
	const normalized = absolutizeUploads(script);
	await saveScriptYaml(normalized, scriptPath);
	onPhase?.("recording", "正在录制浏览器演示…");
	const loaded = await loadDemoScript(scriptPath);
	await recordFromScript(loaded, outDir);
	onPhase?.("polishing", "正在 Remotion 抛光…");
	const videoPath = await polishJob(outDir);
	onPhase?.("done", "成片已就绪");
	return { scriptPath, videoPath };
}

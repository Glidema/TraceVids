/**
 * One-shot pipeline:
 *   npm run demo -- --script scripts/formats-to-mp3.yaml
 *   npm run demo -- --url https://... --goal "演示核心功能"
 */

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvFile } from "./loadEnv.js";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const WORKFLOW = path.resolve(ROOT, "..");
loadEnvFile(WORKFLOW);

function run(cmd: string, args: string[], cwd = WORKFLOW): Promise<void> {
	return new Promise((resolve, reject) => {
		const child = spawn(cmd, args, { cwd, stdio: "inherit", shell: process.platform === "win32" });
		child.on("exit", (code) => {
			if (code === 0) resolve();
			else reject(new Error(`${cmd} ${args.join(" ")} exited ${code}`));
		});
	});
}

function parseArgs(argv: string[]) {
	const args = argv.slice(2);
	let script = "";
	let url = "";
	let goal = "";
	let outDir = path.join(WORKFLOW, "output", `demo-${Date.now()}`);
	for (let i = 0; i < args.length; i++) {
		if (args[i] === "--script" || args[i] === "-s") script = path.resolve(args[++i] ?? "");
		else if (args[i] === "--url" || args[i] === "-u") url = args[++i] ?? "";
		else if (args[i] === "--goal" || args[i] === "-g") goal = args[++i] ?? "";
		else if (args[i] === "--out" || args[i] === "-o") outDir = path.resolve(args[++i] ?? outDir);
		else if (!args[i].startsWith("-") && !url) url = args[i];
	}
	if (!script && !url) {
		script = path.join(WORKFLOW, "scripts/formats-to-mp3.yaml");
	}
	return { script, url, goal, outDir };
}

async function main() {
	const { script, url, goal, outDir } = parseArgs(process.argv);
	let scriptPath = script;

	if (url) {
		const host = new URL(url).hostname.replace(/\W+/g, "-");
		scriptPath = path.join(outDir, `${host}.agent.yaml`);
		console.log(`[demo] generating script for ${url}`);
		await run("npx", [
			"tsx",
			"src/agent.ts",
			url,
			"--goal",
			goal || "用短视频演示这个页面的核心功能，突出主 CTA",
			"--out",
			scriptPath,
		]);
	}

	console.log(`[demo] script=${scriptPath}`);
	console.log(`[demo] out=${outDir}`);

	await run("npx", ["tsx", "src/recordUrl.ts", "--script", scriptPath, "--out", outDir]);
	await run("npx", ["tsx", "render.ts", outDir], path.join(WORKFLOW, "polish"));

	console.log(`[demo] raw:      ${path.join(outDir, "demo.webm")}`);
	console.log(`[demo] polished: ${path.join(outDir, "demo-polished.mp4")}`);
}

main().catch((err) => {
	console.error(err instanceof Error ? err.message : err);
	process.exit(1);
});

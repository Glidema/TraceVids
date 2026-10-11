/**
 * One-shot: YAML script → record → Remotion polish.
 *
 *   npm run demo -- --script scripts/formats-to-mp3.yaml
 */

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const WORKFLOW = path.resolve(ROOT, "..");

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
	let script = path.join(WORKFLOW, "scripts/formats-to-mp3.yaml");
	let outDir = path.join(WORKFLOW, "output", `demo-${Date.now()}`);
	for (let i = 0; i < args.length; i++) {
		if (args[i] === "--script" || args[i] === "-s") script = path.resolve(args[++i] ?? script);
		else if (args[i] === "--out" || args[i] === "-o") outDir = path.resolve(args[++i] ?? outDir);
	}
	return { script, outDir };
}

async function main() {
	const { script, outDir } = parseArgs(process.argv);
	console.log(`[demo] script=${script}`);
	console.log(`[demo] out=${outDir}`);

	await run("npx", ["tsx", "src/recordUrl.ts", "--script", script, "--out", outDir]);
	await run("npx", ["tsx", "render.ts", outDir], path.join(WORKFLOW, "polish"));

	console.log(`[demo] raw:      ${path.join(outDir, "demo.webm")}`);
	console.log(`[demo] polished: ${path.join(outDir, "demo-polished.mp4")}`);
}

main().catch((err) => {
	console.error(err instanceof Error ? err.message : err);
	process.exit(1);
});

/**
 * Heuristic scout (no LLM). Prefer `npm run agent` when you have an API key.
 *
 *   npm run scout -- https://example.com -o scripts/example.yaml
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { stringify as toYaml } from "yaml";
import { generateScriptHeuristic } from "./script/generateScript.js";
import { collectPageContext } from "./script/pageContext.js";

function parseArgs(argv: string[]) {
	const args = argv.slice(2);
	let url = "";
	let out = "";
	let goal = "用短视频演示这个页面的核心功能";
	for (let i = 0; i < args.length; i++) {
		if (args[i] === "-o" || args[i] === "--out") out = path.resolve(args[++i] ?? "");
		else if (args[i] === "--goal" || args[i] === "-g") goal = args[++i] ?? goal;
		else if (!args[i].startsWith("-")) url = args[i];
	}
	if (!url) throw new Error("Usage: npm run scout -- <url> [-o scripts/out.yaml] [--goal \"...\"]");
	new URL(url);
	if (!out) {
		const host = new URL(url).hostname.replace(/\W+/g, "-");
		out = path.resolve("scripts", `${host}.yaml`);
	}
	return { url, out, goal };
}

async function main() {
	const { url, out, goal } = parseArgs(process.argv);
	const context = await collectPageContext(url);
	const script = generateScriptHeuristic({ url, goal, context });
	await mkdir(path.dirname(out), { recursive: true });
	await writeFile(
		out,
		`# Scout heuristic draft — edit before recording.\n# For LLM scripts: npm run agent -- <url> --goal "..."\n${toYaml(script)}`,
		"utf8",
	);
	console.log(`[scout] wrote ${out}`);
	console.log(`[scout] title=${script.title}`);
	console.log(`[scout] buttons=${context.buttons.join(" | ") || "(none)"}`);
}

main().catch((err) => {
	console.error(err instanceof Error ? err.message : err);
	process.exit(1);
});

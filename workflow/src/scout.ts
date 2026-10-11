/**
 * Lightweight "Agent" scout: open a URL, propose a YAML step script.
 * Heuristic only (no LLM) — good enough to bootstrap a script humans/agents edit.
 *
 *   npm run scout -- https://example.com -o scripts/example.yaml
 */

import { writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { stringify as toYaml } from "yaml";

function parseArgs(argv: string[]) {
	const args = argv.slice(2);
	let url = "";
	let out = "";
	for (let i = 0; i < args.length; i++) {
		if (args[i] === "-o" || args[i] === "--out") out = path.resolve(args[++i] ?? "");
		else if (!args[i].startsWith("-")) url = args[i];
	}
	if (!url) throw new Error("Usage: npm run scout -- <url> [-o scripts/out.yaml]");
	new URL(url);
	if (!out) {
		const host = new URL(url).hostname.replace(/\W+/g, "-");
		out = path.resolve("scripts", `${host}.yaml`);
	}
	return { url, out };
}

async function main() {
	const { url, out } = parseArgs(process.argv);
	let browser;
	try {
		browser = await chromium.launch({ headless: true, channel: "chrome" });
	} catch {
		browser = await chromium.launch({ headless: true });
	}
	const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
	await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
	await page.waitForTimeout(800);

	const info = await page.evaluate(() => {
		const title =
			document.querySelector("h1")?.textContent?.trim() ||
			document.title.trim() ||
			location.hostname;
		const buttons = [...document.querySelectorAll("button, a[role='button'], input[type=submit]")]
			.map((el) => (el.textContent || (el as HTMLInputElement).value || "").trim())
			.filter((t) => t.length > 0 && t.length < 40)
			.slice(0, 6);
		const links = [...document.querySelectorAll("a[href]")]
			.map((a) => (a.textContent || "").trim())
			.filter((t) => t.length > 1 && t.length < 32)
			.slice(0, 6);
		const hasFile = Boolean(document.querySelector('input[type="file"]'));
		return { title, buttons, links, hasFile };
	});

	await browser.close();

	const steps: Array<Record<string, unknown>> = [
		{ action: "goto", waitUntil: "domcontentloaded" },
		{ action: "wait", ms: 1200 },
	];

	if (info.hasFile) {
		steps.push(
			{ action: "scroll", selector: 'input[type="file"]' },
			{ action: "wait", ms: 800 },
			{
				action: "upload",
				selector: 'input[type="file"]',
				path: "../fixtures/sample-tone.wav",
			},
			{ action: "wait", ms: 1200 },
		);
	}

	const cta = info.buttons[0] || info.links[0];
	if (cta) {
		steps.push(
			{ action: "click", selector: `text=${JSON.stringify(cta)}` },
			{ action: "wait", ms: 1500 },
		);
	}

	steps.push({ action: "scroll", y: 600 }, { action: "wait", ms: 900 });

	const doc = {
		name: new URL(url).hostname,
		url,
		title: info.title.slice(0, 48),
		subtitle: "Auto-scout draft — edit before recording",
		viewport: { width: 1280, height: 720 },
		steps,
	};

	await writeFile(out, toYaml(doc), "utf8");
	console.log(`[scout] wrote ${out}`);
	console.log(`[scout] title=${doc.title}`);
	console.log(`[scout] buttons=${info.buttons.join(" | ") || "(none)"}`);
}

main().catch((err) => {
	console.error(err instanceof Error ? err.message : err);
	process.exit(1);
});

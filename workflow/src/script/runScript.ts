import type { Page } from "playwright";
import type { DemoScript, DemoStep, ScriptEvent } from "./types.js";

async function pause(page: Page, ms: number) {
	await page.waitForTimeout(ms);
}

function startedAt(t0: number) {
	return Date.now() - t0;
}

async function runStep(page: Page, step: DemoStep, scriptUrl: string, t0: number): Promise<ScriptEvent> {
	const base: ScriptEvent = { tMs: startedAt(t0), action: step.action };

	switch (step.action) {
		case "goto": {
			const url = step.url ?? scriptUrl;
			await page.goto(url, {
				waitUntil: step.waitUntil ?? "domcontentloaded",
				timeout: 60_000,
			});
			return { ...base, label: url };
		}
		case "wait": {
			if (step.selector) {
				await page.locator(step.selector).first().waitFor({
					state: step.state ?? "visible",
					timeout: 30_000,
				});
			}
			if (step.ms) await pause(page, step.ms);
			return { ...base, label: step.selector };
		}
		case "click": {
			const loc = page.locator(step.selector).first();
			await loc.scrollIntoViewIfNeeded();
			const box = await loc.boundingBox();
			await loc.click({ button: step.button ?? "left", timeout: 10_000 });
			await pause(page, 400);
			return {
				...base,
				label: step.selector,
				x: box ? box.x + box.width / 2 : undefined,
				y: box ? box.y + box.height / 2 : undefined,
			};
		}
		case "hover": {
			const loc = page.locator(step.selector).first();
			await loc.scrollIntoViewIfNeeded();
			const box = await loc.boundingBox();
			await loc.hover({ timeout: 10_000 });
			await pause(page, 350);
			return {
				...base,
				label: step.selector,
				x: box ? box.x + box.width / 2 : undefined,
				y: box ? box.y + box.height / 2 : undefined,
			};
		}
		case "type": {
			const loc = page.locator(step.selector).first();
			await loc.scrollIntoViewIfNeeded();
			if (step.clear) await loc.fill("");
			await loc.type(step.text, { delay: step.delayMs ?? 40 });
			return { ...base, label: step.text };
		}
		case "press": {
			await page.keyboard.press(step.key);
			return { ...base, label: step.key };
		}
		case "scroll": {
			if (step.selector) {
				await page.locator(step.selector).first().scrollIntoViewIfNeeded();
			} else {
				await page.mouse.wheel(step.x ?? 0, step.y ?? 500);
			}
			await pause(page, 400);
			return { ...base, label: step.selector ?? `y=${step.y ?? 500}` };
		}
		case "upload": {
			const selector = step.selector ?? 'input[type="file"]';
			await page.locator(selector).first().setInputFiles(step.path);
			await pause(page, 800);
			return { ...base, label: step.path };
		}
		case "assert": {
			const loc = page.locator(step.selector).first();
			await loc.waitFor({ state: "visible", timeout: 15_000 });
			if (step.textContains) {
				await loc.filter({ hasText: step.textContains }).first().waitFor({ timeout: 10_000 });
			}
			return { ...base, label: step.selector };
		}
		default: {
			const _exhaustive: never = step;
			throw new Error(`Unknown step: ${JSON.stringify(_exhaustive)}`);
		}
	}
}

export async function runDemoScript(page: Page, script: DemoScript): Promise<ScriptEvent[]> {
	const t0 = Date.now();
	const events: ScriptEvent[] = [];

	const hasGoto = script.steps.some((s) => s.action === "goto");
	if (!hasGoto) {
		await page.goto(script.url, { waitUntil: "domcontentloaded", timeout: 60_000 });
		events.push({ tMs: 0, action: "goto", label: script.url });
		await pause(page, 800);
	}

	for (let i = 0; i < script.steps.length; i++) {
		const step = script.steps[i];
		try {
			const ev = await runStep(page, step, script.url, t0);
			events.push(ev);
			console.log(`[script] ${i + 1}/${script.steps.length} ${step.action}`);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			console.warn(`[script] step ${i + 1} ${step.action} failed: ${message}`);
			events.push({
				tMs: startedAt(t0),
				action: `${step.action}:error`,
				label: message.slice(0, 120),
			});
		}
	}

	await pause(page, 600);
	return events;
}

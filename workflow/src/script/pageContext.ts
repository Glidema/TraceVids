import { chromium, type Page } from "playwright";

export interface PageContext {
	url: string;
	title: string;
	h1: string;
	description: string;
	headings: string[];
	buttons: string[];
	links: Array<{ text: string; href: string }>;
	inputs: Array<{ type: string; name: string; placeholder: string }>;
	hasFileUpload: boolean;
	bodyTextSample: string;
}

export async function launchBrowser(headed = false) {
	try {
		return await chromium.launch({ headless: !headed, channel: "chrome" });
	} catch {
		return await chromium.launch({ headless: !headed });
	}
}

export async function collectPageContext(url: string, headed = false): Promise<PageContext> {
	const browser = await launchBrowser(headed);
	const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
	try {
		await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
		await page.waitForLoadState("networkidle").catch(() => undefined);
		await page.waitForTimeout(600);
		return await readPageContext(page, url);
	} finally {
		await browser.close();
	}
}

export async function readPageContext(page: Page, url: string): Promise<PageContext> {
	// Keep this callback free of nested function declarations — tsx/esbuild
	// injects __name helpers that break Playwright's serialization.
	return page.evaluate(`({
		url: ${JSON.stringify(url)},
		title: document.title.trim(),
		h1: (document.querySelector("h1")?.textContent || "").replace(/\\s+/g, " ").trim(),
		description: (document.querySelector('meta[name="description"]')?.content || "").trim(),
		headings: [...document.querySelectorAll("h1, h2, h3")]
			.map((h) => (h.textContent || "").replace(/\\s+/g, " ").trim())
			.filter(Boolean)
			.slice(0, 16),
		buttons: [...new Set(
			[...document.querySelectorAll("button, a[role='button'], input[type=submit], input[type=button]")]
				.map((el) => ((el.textContent || "").replace(/\\s+/g, " ").trim() || el.value || ""))
				.filter((t) => t.length > 0 && t.length < 48)
				.slice(0, 16)
		)],
		links: [...document.querySelectorAll("a[href]")]
			.map((a) => ({
				text: (a.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 48),
				href: a.getAttribute("href") || "",
			}))
			.filter((l) => l.text.length > 1)
			.slice(0, 20),
		inputs: [...document.querySelectorAll("input, textarea, select")]
			.map((el) => ({
				type: el.type || el.tagName.toLowerCase(),
				name: el.name || el.id || "",
				placeholder: el.placeholder || "",
			}))
			.slice(0, 20),
		hasFileUpload: Boolean(document.querySelector('input[type="file"]')),
		bodyTextSample: (document.body?.innerText || "").replace(/\\s+/g, " ").trim().slice(0, 1800),
	})`) as Promise<PageContext>;
}

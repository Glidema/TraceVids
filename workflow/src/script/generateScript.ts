import { createOpenAI } from "@ai-sdk/openai";
import { generateText, Output } from "ai";
import type { PageContext } from "./pageContext.js";
import { demoScriptSchema, type GeneratedDemoScript } from "./schema.js";

export interface GenerateOptions {
	url: string;
	goal: string;
	context: PageContext;
	/** Prefer fixture path for uploads in generated scripts. */
	uploadFixturePath?: string;
}

function envModel() {
	const apiKey =
		process.env.OPENAI_API_KEY ||
		process.env.OPENROUTER_API_KEY ||
		process.env.TRACEVIDS_API_KEY;
	const baseURL =
		process.env.OPENAI_BASE_URL ||
		(process.env.OPENROUTER_API_KEY ? "https://openrouter.ai/api/v1" : undefined);
	const modelId =
		process.env.TRACEVIDS_MODEL ||
		process.env.OPENAI_MODEL ||
		(process.env.OPENROUTER_API_KEY ? "openai/gpt-4o-mini" : "gpt-4o-mini");

	if (!apiKey) return null;

	const openai = createOpenAI({
		apiKey,
		baseURL,
		name: "tracevids",
	});
	return openai(modelId);
}

function quoteTextSelector(label: string) {
	// Playwright text= engine: quote when spaces / punctuation present.
	if (/^[\w\u4e00-\u9fff]+$/.test(label)) return `text=${label}`;
	return `text=${JSON.stringify(label)}`;
}

/** Improved heuristic when no API key — uses goal keywords + page context. */
export function generateScriptHeuristic(opts: GenerateOptions): GeneratedDemoScript {
	const { url, goal, context, uploadFixturePath = "../fixtures/sample-tone.wav" } = opts;
	const goalLower = goal.toLowerCase();
	const steps: GeneratedDemoScript["steps"] = [
		{ action: "goto", waitUntil: "domcontentloaded" },
		{ action: "wait", ms: 1200 },
	];

	const captions: GeneratedDemoScript["captions"] = [{ atStep: 0, text: context.h1 || context.title || goal }];

	// Prefer file upload flows when page + goal suggest conversion / upload.
	const wantsUpload =
		context.hasFileUpload &&
		(/上传|上傳|转换|轉換|转码|轉檔|convert|upload|mp3|文件|檔案/.test(goal) ||
			/upload|convert|mp3|file/i.test(context.bodyTextSample));

	if (wantsUpload) {
		steps.push(
			{ action: "scroll", selector: 'input[type="file"]' },
			{ action: "wait", ms: 700 },
			{ action: "upload", selector: 'input[type="file"]', path: uploadFixturePath },
			{ action: "wait", ms: 1400 },
		);
		captions.push({ atStep: steps.length - 2, text: "上传示例文件" });
	}

	const ctaPool = [...context.buttons, ...context.links.map((l) => l.text)];
	const goalTokens = goalLower.split(/[\s,，、]+/).filter((t) => t.length >= 2);
	const ranked = ctaPool
		.map((label) => {
			const l = label.toLowerCase();
			const score = goalTokens.reduce((s, t) => (l.includes(t) ? s + 2 : s), 0);
			return { label, score };
		})
		.sort((a, b) => b.score - a.score);

	const clicked = new Set<string>();
	for (const item of ranked.slice(0, 3)) {
		if (!item.label || clicked.has(item.label)) continue;
		if (item.score === 0 && clicked.size > 0) break;
		clicked.add(item.label);
		steps.push({ action: "click", selector: quoteTextSelector(item.label) }, { action: "wait", ms: 1400 });
		captions.push({ atStep: steps.length - 2, text: item.label.slice(0, 40) });
	}

	if (context.headings[1]) {
		steps.push(
			{ action: "scroll", selector: quoteTextSelector(context.headings[1].slice(0, 40)) },
			{ action: "wait", ms: 1000 },
		);
		captions.push({ atStep: steps.length - 2, text: context.headings[1].slice(0, 40) });
	} else {
		steps.push({ action: "scroll", y: 600 }, { action: "wait", ms: 900 });
	}

	const title = (context.h1 || context.title || goal).slice(0, 48);
	return demoScriptSchema.parse({
		name: new URL(url).hostname.replace(/\W+/g, "-"),
		url,
		title,
		subtitle: goal.slice(0, 80),
		locale: /[\u4e00-\u9fff]/.test(goal + context.bodyTextSample) ? "zh-CN" : "en-US",
		aspectRatio: "16:9",
		voiceover: true,
		brandColor: "#ff6b3d",
		captions,
		viewport: { width: 1280, height: 720 },
		steps,
	});
}

export async function generateScriptWithLlm(opts: GenerateOptions): Promise<GeneratedDemoScript> {
	const model = envModel();
	if (!model) {
		throw new Error(
			"No LLM API key. Set OPENAI_API_KEY (or OPENROUTER_API_KEY / TRACEVIDS_API_KEY). Optional: OPENAI_BASE_URL, TRACEVIDS_MODEL.",
		);
	}

	const fixture = opts.uploadFixturePath ?? "../fixtures/sample-tone.wav";
	const { output } = await generateText({
		model,
		output: Output.object({ schema: demoScriptSchema }),
		temperature: 0.3,
		system: `You write TraceVids browser demo scripts as structured JSON.
Rules:
- Produce a short product-demo walkthrough (8–20 steps), not a full QA crawl.
- Prefer Playwright selectors: text=可见文案, css=..., role=button[name=/.../i].
- Use exact visible labels from PAGE CONTEXT when clicking.
- After every click/upload/scroll, insert wait (700–1800ms) so the camera can breathe.
- First step should be goto (waitUntil domcontentloaded or networkidle).
- If the page has a file input and the goal involves convert/upload, include an upload step with path "${fixture}".
- captions: 3–8 short Chinese or English lines tied to step indexes (atStep), for on-video subtitles and TTS narration.
- aspectRatio: default "16:9"; use "9:16" for short-video / "1:1" for feed square when the goal implies it.
- voiceover: true unless the user asks for silent video.
- brandColor: a hex accent that fits the page (default #ff6b3d).
- title/subtitle: marketing-ready, match the user goal.
- Do not invent URLs outside the given site.
- Avoid cookie-banner rabbit holes unless required.`,
		prompt: `TARGET URL: ${opts.url}
USER GOAL: ${opts.goal}

PAGE CONTEXT (JSON):
${JSON.stringify(opts.context, null, 2)}
`,
	});

	// Ensure url is the requested one.
	return demoScriptSchema.parse({ ...output, url: opts.url });
}

export async function generateDemoScript(opts: GenerateOptions): Promise<{
	script: GeneratedDemoScript;
	mode: "llm" | "heuristic";
}> {
	if (envModel()) {
		try {
			const script = await generateScriptWithLlm(opts);
			return { script, mode: "llm" };
		} catch (err) {
			console.warn(
				`[agent] LLM failed, falling back to heuristic: ${
					err instanceof Error ? err.message : String(err)
				}`,
			);
		}
	}
	return { script: generateScriptHeuristic(opts), mode: "heuristic" };
}

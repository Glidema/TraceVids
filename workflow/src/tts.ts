/**
 * Narration TTS for TraceVids polish.
 *
 * Primary: OpenAI Audio Speech API (tts-1) when OPENAI_API_KEY / OPENROUTER is set.
 * Fallback (macOS only): system `say` → AIFF → m4a via afconvert.
 *
 *   OpenAI voices: alloy | echo | fable | onyx | nova | shimmer
 */

import { spawn } from "node:child_process";
import { access, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvFile } from "./loadEnv.js";

const WORKFLOW_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
loadEnvFile(WORKFLOW_ROOT);

export type TtsMode = "openai" | "macos-say" | "none";

export interface TtsResult {
	mode: TtsMode;
	audioPath: string | null;
	text: string;
	voice?: string;
}

function apiKey() {
	return (
		process.env.OPENAI_API_KEY ||
		process.env.OPENROUTER_API_KEY ||
		process.env.TRACEVIDS_API_KEY ||
		""
	);
}

function baseUrl() {
	if (process.env.OPENAI_BASE_URL) return process.env.OPENAI_BASE_URL.replace(/\/$/, "");
	if (process.env.OPENROUTER_API_KEY) return "https://openrouter.ai/api/v1";
	return "https://api.openai.com/v1";
}

function run(cmd: string, args: string[]): Promise<void> {
	return new Promise((resolve, reject) => {
		const child = spawn(cmd, args, { stdio: "inherit" });
		child.on("exit", (code) => {
			if (code === 0) resolve();
			else reject(new Error(`${cmd} exited ${code}`));
		});
	});
}

export function buildNarrationText(input: {
	title?: string;
	subtitle?: string;
	captions?: Array<{ text: string }>;
	narration?: string;
}): string {
	if (input.narration?.trim()) return input.narration.trim();
	const parts: string[] = [];
	if (input.title?.trim()) parts.push(input.title.trim());
	if (input.subtitle?.trim()) parts.push(input.subtitle.trim());
	for (const c of input.captions ?? []) {
		if (c.text?.trim()) parts.push(c.text.trim());
	}
	return parts.join("。").replace(/。+/g, "。").slice(0, 1200);
}

async function synthesizeOpenAi(text: string, outMp3: string): Promise<TtsResult> {
	const key = apiKey();
	if (!key) throw new Error("missing api key");
	const voice = process.env.TRACEVIDS_TTS_VOICE || "nova";
	const model = process.env.TRACEVIDS_TTS_MODEL || "tts-1";
	const res = await fetch(`${baseUrl()}/audio/speech`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${key}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			model,
			voice,
			input: text,
			format: "mp3",
		}),
	});
	if (!res.ok) {
		const errText = await res.text();
		throw new Error(`OpenAI TTS ${res.status}: ${errText.slice(0, 200)}`);
	}
	const buf = Buffer.from(await res.arrayBuffer());
	await writeFile(outMp3, buf);
	return { mode: "openai", audioPath: outMp3, text, voice };
}

async function synthesizeMacSay(text: string, outM4a: string): Promise<TtsResult> {
	if (process.platform !== "darwin") {
		throw new Error("macOS say fallback only works on Darwin");
	}
	const voice = process.env.TRACEVIDS_SAY_VOICE || "Tingting";
	const aiff = outM4a.replace(/\.m4a$/i, ".aiff");
	await run("say", ["-v", voice, "-o", aiff, text]);
	await run("afconvert", ["-f", "m4af", "-d", "aac", aiff, outM4a]);
	await access(outM4a);
	return { mode: "macos-say", audioPath: outM4a, text, voice };
}

/**
 * Write narration audio into outDir. Returns null audioPath when disabled / empty text.
 */
export async function synthesizeNarration(opts: {
	outDir: string;
	enabled: boolean;
	title?: string;
	subtitle?: string;
	captions?: Array<{ text: string }>;
	narration?: string;
}): Promise<TtsResult> {
	const text = buildNarrationText(opts);
	if (!opts.enabled || !text.trim()) {
		return { mode: "none", audioPath: null, text };
	}

	const mp3Path = path.join(opts.outDir, "voiceover.mp3");
	const m4aPath = path.join(opts.outDir, "voiceover.m4a");

	try {
		if (apiKey()) {
			const result = await synthesizeOpenAi(text, mp3Path);
			console.log(`[tts] openai voice=${result.voice} → ${mp3Path}`);
			return result;
		}
	} catch (err) {
		console.warn(`[tts] OpenAI failed: ${err instanceof Error ? err.message : err}`);
	}

	try {
		const result = await synthesizeMacSay(text, m4aPath);
		console.log(`[tts] macos-say voice=${result.voice} → ${m4aPath}`);
		return result;
	} catch (err) {
		console.warn(`[tts] fallback failed: ${err instanceof Error ? err.message : err}`);
		return { mode: "none", audioPath: null, text };
	}
}

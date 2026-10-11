/**
 * TraceVids product shell — local web UI + API.
 *
 *   npm run app
 *   open http://127.0.0.1:8787
 */

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { loadEnvFile } from "./loadEnv.js";
import {
	generateScriptForUrl,
	produceFromScript,
	WORKFLOW_ROOT,
	type JobState,
} from "./pipeline.js";
import { demoScriptSchema } from "./script/schema.js";

loadEnvFile(WORKFLOW_ROOT);

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB_DIR = path.resolve(HERE, "../web");
const PORT = Number(process.env.PORT || 8787);
const jobs = new Map<string, JobState>();

function json(res: import("node:http").ServerResponse, status: number, body: unknown) {
	const data = JSON.stringify(body);
	res.writeHead(status, {
		"Content-Type": "application/json; charset=utf-8",
		"Content-Length": Buffer.byteLength(data),
	});
	res.end(data);
}

function touch(job: JobState, phase: JobState["phase"], message: string, extra: Partial<JobState> = {}) {
	Object.assign(job, extra, { phase, message, updatedAt: new Date().toISOString() });
	jobs.set(job.id, job);
}

async function readBody(req: import("node:http").IncomingMessage) {
	const chunks: Buffer[] = [];
	for await (const chunk of req) chunks.push(Buffer.from(chunk));
	const raw = Buffer.concat(chunks).toString("utf8");
	if (!raw) return {};
	return JSON.parse(raw) as Record<string, unknown>;
}

async function serveStatic(res: import("node:http").ServerResponse, urlPath: string) {
	const safe = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, "");
	const filePath = path.join(WEB_DIR, safe === "/" ? "index.html" : safe);
	if (!filePath.startsWith(WEB_DIR)) {
		res.writeHead(403).end("Forbidden");
		return;
	}
	try {
		const data = await readFile(filePath);
		const ext = path.extname(filePath);
		const types: Record<string, string> = {
			".html": "text/html; charset=utf-8",
			".css": "text/css; charset=utf-8",
			".js": "text/javascript; charset=utf-8",
			".svg": "image/svg+xml",
			".png": "image/png",
			".jpg": "image/jpeg",
			".webp": "image/webp",
		};
		res.writeHead(200, { "Content-Type": types[ext] || "application/octet-stream" });
		res.end(data);
	} catch {
		res.writeHead(404).end("Not found");
	}
}

const server = createServer(async (req, res) => {
	try {
		const host = req.headers.host || `127.0.0.1:${PORT}`;
		const url = new URL(req.url || "/", `http://${host}`);
		const { pathname } = url;

		if (req.method === "GET" && pathname === "/api/health") {
			return json(res, 200, { ok: true });
		}

		if (req.method === "POST" && pathname === "/api/generate") {
			const body = await readBody(req);
			const target = String(body.url || "");
			const goal = String(body.goal || "用短视频演示这个页面的核心功能，突出主 CTA");
			new URL(target);
			const { script, mode } = await generateScriptForUrl(target, goal);
			return json(res, 200, { script, mode });
		}

		if (req.method === "POST" && pathname === "/api/produce") {
			const body = await readBody(req);
			const script = demoScriptSchema.parse(body.script);
			const id = randomUUID().slice(0, 8);
			const outDir = path.join(WORKFLOW_ROOT, "output", `job-${id}`);
			const job: JobState = {
				id,
				phase: "queued",
				message: "任务已创建",
				outDir,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			};
			jobs.set(id, job);

			void (async () => {
				try {
					const result = await produceFromScript(script, outDir, (phase, message) => {
						touch(job, phase, message);
					});
					touch(job, "done", "成片已就绪", {
						scriptPath: result.scriptPath,
						videoPath: result.videoPath,
					});
				} catch (err) {
					touch(job, "error", "出片失败", {
						error: err instanceof Error ? err.message : String(err),
					});
				}
			})();

			return json(res, 202, { jobId: id });
		}

		if (req.method === "GET" && pathname.startsWith("/api/jobs/")) {
			const parts = pathname.split("/").filter(Boolean);
			// /api/jobs/:id or /api/jobs/:id/download
			const id = parts[2];
			const job = jobs.get(id);
			if (!job) return json(res, 404, { error: "job not found" });

			if (parts[3] === "download") {
				if (job.phase !== "done" || !job.videoPath) {
					return json(res, 409, { error: "video not ready" });
				}
				const file = job.videoPath;
				const info = await stat(file);
				res.writeHead(200, {
					"Content-Type": "video/mp4",
					"Content-Length": info.size,
					"Content-Disposition": `attachment; filename="tracevids-${id}.mp4"`,
				});
				const { createReadStream } = await import("node:fs");
				createReadStream(file).pipe(res);
				return;
			}

			return json(res, 200, job);
		}

		if (req.method === "GET") {
			return serveStatic(res, pathname);
		}

		json(res, 405, { error: "method not allowed" });
	} catch (err) {
		json(res, 400, { error: err instanceof Error ? err.message : String(err) });
	}
});

server.listen(PORT, "127.0.0.1", () => {
	console.log(`[tracevids] app http://127.0.0.1:${PORT}`);
});

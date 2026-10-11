const $ = (id) => document.getElementById(id);

const els = {
	url: $("url"),
	goal: $("goal"),
	title: $("title"),
	subtitle: $("subtitle"),
	brandColor: $("brandColor"),
	aspectRatio: $("aspectRatio"),
	voiceover: $("voiceover"),
	stepsJson: $("steps-json"),
	genStatus: $("gen-status"),
	produceStatus: $("produce-status"),
	modeBadge: $("mode-badge"),
	inputPanel: $("input-panel"),
	stepsPanel: $("steps-panel"),
	resultPanel: $("result-panel"),
	preview: $("preview"),
	download: $("btn-download"),
	btnGenerate: $("btn-generate"),
	btnProduce: $("btn-produce"),
	btnBack: $("btn-back"),
	btnRestart: $("btn-restart"),
};

let currentScript = null;

function show(panel) {
	els.inputPanel.classList.toggle("hidden", panel !== "input");
	els.stepsPanel.classList.toggle("hidden", panel !== "steps");
	els.resultPanel.classList.toggle("hidden", panel !== "result");
}

function setHint(el, text, kind = "") {
	el.textContent = text || "";
	el.classList.remove("error", "ok");
	if (kind) el.classList.add(kind);
}

function fillEditor(script) {
	currentScript = script;
	els.title.value = script.title || "";
	els.subtitle.value = script.subtitle || "";
	els.brandColor.value = script.brandColor || "#ff6b3d";
	els.aspectRatio.value = script.aspectRatio || "16:9";
	els.voiceover.checked = script.voiceover !== false;
	els.stepsJson.value = JSON.stringify(script.steps, null, 2);
}

function readEditorScript() {
	if (!currentScript) throw new Error("还没有脚本");
	let steps;
	try {
		steps = JSON.parse(els.stepsJson.value);
	} catch {
		throw new Error("步骤 JSON 无法解析，请检查格式");
	}
	return {
		...currentScript,
		title: els.title.value.trim() || currentScript.title,
		subtitle: els.subtitle.value.trim(),
		brandColor: els.brandColor.value.trim() || "#ff6b3d",
		aspectRatio: els.aspectRatio.value || "16:9",
		voiceover: Boolean(els.voiceover.checked),
		steps,
	};
}

async function generate() {
	const url = els.url.value.trim();
	if (!url) {
		setHint(els.genStatus, "请先填写网址", "error");
		return;
	}
	els.btnGenerate.disabled = true;
	setHint(els.genStatus, "正在打开页面并生成步骤…");
	try {
		const res = await fetch("/api/generate", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ url, goal: els.goal.value.trim() }),
		});
		const data = await res.json();
		if (!res.ok) throw new Error(data.error || "生成失败");
		fillEditor(data.script);
		els.modeBadge.textContent = data.mode === "llm" ? "LLM" : "Heuristic";
		show("steps");
		setHint(els.genStatus, "");
		setHint(els.produceStatus, "请审阅步骤，然后生成视频");
	} catch (err) {
		setHint(els.genStatus, err.message || String(err), "error");
	} finally {
		els.btnGenerate.disabled = false;
	}
}

async function pollJob(jobId) {
	for (;;) {
		await new Promise((r) => setTimeout(r, 1500));
		const res = await fetch(`/api/jobs/${jobId}`);
		const job = await res.json();
		if (!res.ok) throw new Error(job.error || "任务不存在");
		setHint(els.produceStatus, job.message || job.phase);
		if (job.phase === "done") return job;
		if (job.phase === "error") throw new Error(job.error || "出片失败");
	}
}

async function produce() {
	els.btnProduce.disabled = true;
	setHint(els.produceStatus, "提交任务…");
	try {
		const script = readEditorScript();
		const res = await fetch("/api/produce", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ script }),
		});
		const data = await res.json();
		if (!res.ok) throw new Error(data.error || "无法创建任务");
		setHint(els.produceStatus, "录制中，首次抛光可能需要几分钟…");
		await pollJob(data.jobId);
		const downloadUrl = `/api/jobs/${data.jobId}/download`;
		els.preview.src = downloadUrl;
		els.download.href = downloadUrl;
		show("result");
		setHint(els.produceStatus, "完成", "ok");
	} catch (err) {
		setHint(els.produceStatus, err.message || String(err), "error");
	} finally {
		els.btnProduce.disabled = false;
	}
}

els.btnGenerate.addEventListener("click", generate);
els.btnProduce.addEventListener("click", produce);
els.btnBack.addEventListener("click", () => show("input"));
els.btnRestart.addEventListener("click", () => {
	els.preview.removeAttribute("src");
	show("input");
});

// Demo-friendly default for local testing
if (!els.url.value) {
	els.url.value = "https://transcribe.com/zh/formats-to-mp3";
	els.goal.value = "演示如何把音频或视频转成 MP3";
}

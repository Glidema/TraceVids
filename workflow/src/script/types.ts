/** Agent / human authored step script for browser demo recording. */

export type DemoStep =
	| { action: "goto"; url?: string; waitUntil?: "load" | "domcontentloaded" | "networkidle" }
	| { action: "wait"; ms?: number; selector?: string; state?: "visible" | "hidden" | "attached" }
	| { action: "click"; selector: string; button?: "left" | "right" | "middle" }
	| { action: "hover"; selector: string }
	| { action: "type"; selector: string; text: string; clear?: boolean; delayMs?: number }
	| { action: "press"; key: string }
	| { action: "scroll"; y?: number; x?: number; selector?: string }
	| { action: "upload"; selector?: string; path: string }
	| { action: "assert"; selector: string; textContains?: string };

export interface DemoScript {
	name?: string;
	url: string;
	viewport?: { width: number; height: number };
	locale?: string;
	/** Shown as Remotion title card. */
	title?: string;
	subtitle?: string;
	steps: DemoStep[];
}

export interface ScriptEvent {
	tMs: number;
	action: string;
	label?: string;
	x?: number;
	y?: number;
}

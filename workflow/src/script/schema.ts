import { z } from "zod";

export const demoStepSchema = z.discriminatedUnion("action", [
	z.object({
		action: z.literal("goto"),
		url: z.string().optional(),
		waitUntil: z.enum(["load", "domcontentloaded", "networkidle"]).optional(),
	}),
	z.object({
		action: z.literal("wait"),
		ms: z.number().int().positive().max(30_000).optional(),
		selector: z.string().optional(),
		state: z.enum(["visible", "hidden", "attached"]).optional(),
	}),
	z.object({
		action: z.literal("click"),
		selector: z.string(),
		button: z.enum(["left", "right", "middle"]).optional(),
	}),
	z.object({
		action: z.literal("hover"),
		selector: z.string(),
	}),
	z.object({
		action: z.literal("type"),
		selector: z.string(),
		text: z.string(),
		clear: z.boolean().optional(),
		delayMs: z.number().int().positive().optional(),
	}),
	z.object({
		action: z.literal("press"),
		key: z.string(),
	}),
	z.object({
		action: z.literal("scroll"),
		y: z.number().optional(),
		x: z.number().optional(),
		selector: z.string().optional(),
	}),
	z.object({
		action: z.literal("upload"),
		selector: z.string().optional(),
		path: z.string(),
	}),
	z.object({
		action: z.literal("assert"),
		selector: z.string(),
		textContains: z.string().optional(),
	}),
]);

export const demoScriptSchema = z.object({
	name: z.string().optional(),
	url: z.string().url(),
	title: z.string().min(1).max(80),
	subtitle: z.string().max(120).optional().default(""),
	locale: z.string().optional(),
	brandColor: z
		.string()
		.regex(/^#[0-9a-fA-F]{6}$/)
		.optional()
		.default("#ff6b3d"),
	captions: z
		.array(
			z.object({
				atStep: z.number().int().nonnegative(),
				text: z.string().min(1).max(80),
			}),
		)
		.optional()
		.default([]),
	viewport: z
		.object({
			width: z.number().int().positive().default(1280),
			height: z.number().int().positive().default(720),
		})
		.optional()
		.default({ width: 1280, height: 720 }),
	steps: z.array(demoStepSchema).min(2).max(40),
});

export type GeneratedDemoScript = z.infer<typeof demoScriptSchema>;

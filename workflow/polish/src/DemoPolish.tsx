import React from "react";
import {
	AbsoluteFill,
	Easing,
	OffthreadVideo,
	Sequence,
	interpolate,
	spring,
	staticFile,
	useCurrentFrame,
	useVideoConfig,
} from "remotion";

export type PolishEvent = {
	tMs: number;
	action: string;
	label?: string;
	x?: number;
	y?: number;
};

export type PolishCaption = {
	/** Absolute ms on the source timeline (resolved from atStep + events). */
	tMs: number;
	text: string;
	durationMs?: number;
};

export type DemoPolishProps = {
	videoFile: string;
	title: string;
	subtitle: string;
	brandColor: string;
	events: PolishEvent[];
	captions: PolishCaption[];
	/** Source video duration in frames at composition fps. */
	sourceFrames: number;
};

export const TITLE_FRAMES = 45;
export const OUTRO_FRAMES = 20;

function withAlpha(hex: string, alpha: number) {
	const raw = hex.replace("#", "");
	if (raw.length !== 6) return `rgba(255,107,61,${alpha})`;
	const r = Number.parseInt(raw.slice(0, 2), 16);
	const g = Number.parseInt(raw.slice(2, 4), 16);
	const b = Number.parseInt(raw.slice(4, 6), 16);
	return `rgba(${r},${g},${b},${alpha})`;
}

export const DemoPolish: React.FC<DemoPolishProps> = ({
	videoFile,
	title,
	subtitle,
	brandColor,
	events,
	captions,
	sourceFrames,
}) => {
	const frame = useCurrentFrame();
	const { fps, width, height } = useVideoConfig();
	const accent = brandColor || "#ff6b3d";

	const zoom = interpolate(
		frame,
		[TITLE_FRAMES, TITLE_FRAMES + sourceFrames * 0.35, TITLE_FRAMES + sourceFrames * 0.75],
		[1.0, 1.08, 1.03],
		{
			easing: Easing.bezier(0.22, 1, 0.36, 1),
			extrapolateLeft: "clamp",
			extrapolateRight: "clamp",
		},
	);

	const titleOpacity = interpolate(frame, [0, 12, TITLE_FRAMES - 10, TITLE_FRAMES], [0, 1, 1, 0], {
		extrapolateLeft: "clamp",
		extrapolateRight: "clamp",
	});
	const titleY = interpolate(frame, [0, 18], [24, 0], {
		easing: Easing.out(Easing.cubic),
		extrapolateLeft: "clamp",
		extrapolateRight: "clamp",
	});

	const clicks = events.filter(
		(e) => (e.action === "click" || e.action === "hover") && e.x != null && e.y != null,
	);

	const activeCaption = (() => {
		const tMs = ((frame - TITLE_FRAMES) / fps) * 1000;
		if (tMs < 0) return null;
		let current: PolishCaption | null = null;
		for (const c of captions) {
			const dur = c.durationMs ?? 2200;
			if (tMs >= c.tMs && tMs <= c.tMs + dur) current = c;
		}
		return current;
	})();

	return (
		<AbsoluteFill style={{ backgroundColor: "#0b1020" }}>
			<AbsoluteFill
				style={{
					opacity: titleOpacity,
					justifyContent: "center",
					alignItems: "center",
					padding: 64,
					transform: `translateY(${titleY}px)`,
				}}
			>
				<div
					style={{
						width: 72,
						height: 6,
						borderRadius: 999,
						backgroundColor: accent,
						marginBottom: 28,
					}}
				/>
				<div
					style={{
						fontFamily: "Georgia, 'Songti SC', serif",
						fontSize: 56,
						color: "#f4f1ea",
						textAlign: "center",
						lineHeight: 1.2,
						maxWidth: 1000,
					}}
				>
					{title}
				</div>
				{subtitle ? (
					<div
						style={{
							marginTop: 18,
							fontFamily: "Helvetica Neue, sans-serif",
							fontSize: 24,
							color: "#9aa4b8",
							letterSpacing: 0.5,
						}}
					>
						{subtitle}
					</div>
				) : null}
			</AbsoluteFill>

			<Sequence from={TITLE_FRAMES} durationInFrames={Math.max(1, sourceFrames)}>
				<AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
					<div
						style={{
							width,
							height,
							transform: `scale(${zoom})`,
							overflow: "hidden",
						}}
					>
						<OffthreadVideo
							src={staticFile(videoFile)}
							style={{ width: "100%", height: "100%", objectFit: "cover" }}
						/>
					</div>

					{clicks.map((ev, i) => {
						const start = Math.round((ev.tMs / 1000) * fps);
						const localFrame = frame - TITLE_FRAMES - start;
						if (localFrame < 0 || localFrame > 28) return null;
						const pulse = spring({
							frame: localFrame,
							fps,
							config: { damping: 14, stiffness: 120 },
						});
						const ring = interpolate(localFrame, [0, 28], [0.6, 1.6]);
						const opacity = interpolate(localFrame, [0, 6, 28], [0, 0.9, 0]);
						return (
							<div
								key={`${ev.tMs}-${i}`}
								style={{
									position: "absolute",
									left: (ev.x ?? 0) - 22,
									top: (ev.y ?? 0) - 22,
									width: 44,
									height: 44,
									borderRadius: 999,
									border: `3px solid ${accent}`,
									boxShadow: `0 0 0 6px ${withAlpha(accent, 0.25)}`,
									transform: `scale(${pulse * ring})`,
									opacity,
									pointerEvents: "none",
								}}
							/>
						);
					})}

					{activeCaption ? (
						<div
							style={{
								position: "absolute",
								left: 0,
								right: 0,
								bottom: 48,
								display: "flex",
								justifyContent: "center",
								pointerEvents: "none",
							}}
						>
							<div
								style={{
									maxWidth: 900,
									padding: "12px 22px",
									borderRadius: 12,
									backgroundColor: "rgba(11,16,32,0.72)",
									borderBottom: `3px solid ${accent}`,
									color: "#f4f1ea",
									fontFamily: "Helvetica Neue, 'PingFang SC', sans-serif",
									fontSize: 28,
									lineHeight: 1.35,
									textAlign: "center",
								}}
							>
								{activeCaption.text}
							</div>
						</div>
					) : null}
				</AbsoluteFill>
			</Sequence>

			<Sequence from={TITLE_FRAMES + Math.max(1, sourceFrames) - OUTRO_FRAMES}>
				<AbsoluteFill
					style={{
						backgroundColor: "#0b1020",
						opacity: interpolate(
							frame - (TITLE_FRAMES + Math.max(1, sourceFrames) - OUTRO_FRAMES),
							[0, OUTRO_FRAMES],
							[0, 1],
							{ extrapolateLeft: "clamp", extrapolateRight: "clamp" },
						),
					}}
				/>
			</Sequence>
		</AbsoluteFill>
	);
};

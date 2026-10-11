import React from "react";
import { Composition } from "remotion";
import { DemoPolish, OUTRO_FRAMES, TITLE_FRAMES, type DemoPolishProps } from "./DemoPolish";

const FPS = 30;

const defaultProps: DemoPolishProps = {
	videoFile: "input.webm",
	title: "Product demo",
	subtitle: "",
	brandColor: "#ff6b3d",
	events: [],
	captions: [],
	sourceFrames: 90,
	voiceoverFile: null,
};

export const RemotionRoot: React.FC = () => {
	return (
		<Composition
			id="DemoPolish"
			component={DemoPolish}
			durationInFrames={TITLE_FRAMES + defaultProps.sourceFrames + OUTRO_FRAMES}
			fps={FPS}
			width={1280}
			height={720}
			defaultProps={defaultProps}
		/>
	);
};

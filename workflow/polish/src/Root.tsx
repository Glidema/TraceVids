import React from "react";
import { Composition } from "remotion";
import { DemoPolish, OUTRO_FRAMES, TITLE_FRAMES, type DemoPolishProps } from "./DemoPolish";

const FPS = 30;
const WIDTH = 1280;
const HEIGHT = 720;

const defaultProps: DemoPolishProps = {
	videoFile: "input.webm",
	title: "Product demo",
	subtitle: "",
	events: [],
	sourceFrames: 90,
};

export const RemotionRoot: React.FC = () => {
	return (
		<>
			<Composition
				id="DemoPolish"
				component={DemoPolish}
				durationInFrames={TITLE_FRAMES + defaultProps.sourceFrames + OUTRO_FRAMES}
				fps={FPS}
				width={WIDTH}
				height={HEIGHT}
				defaultProps={defaultProps}
			/>
		</>
	);
};

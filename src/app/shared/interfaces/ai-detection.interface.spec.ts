import {
    AiAvailableModelsMessage,
    AiResult,
    isClassificationsResult,
    isDetectionResult,
    isErrorResult,
    isHeadsResult,
    isKeypointsResult,
    isLinesResult,
    isPredictionsResult,
    toModelList,
} from "./ai-detection.interface";

/**
 * Fixtures follow what `oak_d_lite/stereo.py` publishes. The previous
 * interfaces assumed a `{models: [...]}` wrapper that the camera node never
 * emits, which left the model dropdown empty on the robot.
 */
describe("ai-detection wire contract", () => {
    describe("toModelList", () => {
        it("flattens the name-keyed payload and keeps the backend's order", () => {
            const payload: AiAvailableModelsMessage = {
                yolov6n: {
                    type: "detection",
                    description: "YOLOv6 Nano",
                    classes: 80,
                    slug: "luxonis/yolov6-nano:r2-coco-512x288",
                },
                gaze: {
                    type: "gaze",
                    description: "L2CS-Net gaze estimation",
                    classes: 0,
                    slug: "luxonis/l2cs-net:448x448",
                },
            };

            const models = toModelList(payload);

            expect(models.map((m) => m.name)).toEqual(["yolov6n", "gaze"]);
            expect(models[0]).toEqual({
                name: "yolov6n",
                type: "detection",
                description: "YOLOv6 Nano",
                classes: 80,
                slug: "luxonis/yolov6-nano:r2-coco-512x288",
            });
        });

        it("returns an empty list when there is nothing to list", () => {
            expect(toModelList(null)).toEqual([]);
            expect(toModelList(undefined)).toEqual([]);
            expect(toModelList({})).toEqual([]);
        });
    });

    describe("result guards", () => {
        it("recognises _format_detections output, with a frame-level mask", () => {
            const result: AiResult = {
                detections: [
                    {
                        label: 0,
                        confidence: 0.87,
                        bbox: {xmin: 0.1, ymin: 0.2, xmax: 0.4, ymax: 0.8},
                        keypoints: [{x: 0.2, y: 0.3}],
                    },
                ],
                count: 1,
                mask_rle: {runs: [4], values: [0], shape: [2, 2]},
            };
            expect(isDetectionResult(result)).toBeTrue();
            expect(isKeypointsResult(result)).toBeFalse();
            expect(isErrorResult(result)).toBeFalse();
        });

        it("recognises _format_keypoints output with and without confidence", () => {
            const result: AiResult = {
                keypoints: [
                    {x: 0.5, y: 0.5, confidence: 0.9},
                    {x: 0.1, y: 0.2},
                ],
                count: 2,
            };
            expect(isKeypointsResult(result)).toBeTrue();
            expect(isDetectionResult(result)).toBeFalse();
        });

        it("recognises _format_lines output", () => {
            const result: AiResult = {
                lines: [
                    {
                        start: {x: 0.1, y: 0.1},
                        end: {x: 0.9, y: 0.9},
                        confidence: 0.7,
                    },
                ],
                count: 1,
            };
            expect(isLinesResult(result)).toBeTrue();
        });

        it("recognises _format_predictions output as plain numbers", () => {
            const result: AiResult = {predictions: [0.42, -0.1], count: 2};
            expect(isPredictionsResult(result)).toBeTrue();
            expect(isClassificationsResult(result)).toBeFalse();
        });

        it("recognises _format_classifications output", () => {
            const result: AiResult = {
                classes: ["left", "right"],
                scores: [0.2, 0.8],
                top_class: "right",
                top_score: 0.8,
            };
            expect(isClassificationsResult(result)).toBeTrue();
            expect(isHeadsResult(result)).toBeFalse();
        });

        it("recognises a multi-head result", () => {
            const result: AiResult = {
                heads: {
                    handedness: {
                        classes: ["left", "right"],
                        scores: [0.9, 0.1],
                        top_class: "left",
                        top_score: 0.9,
                    },
                    landmarks: {keypoints: [{x: 0.5, y: 0.5}], count: 1},
                },
            };
            expect(isHeadsResult(result)).toBeTrue();
            expect(isDetectionResult(result)).toBeFalse();
        });

        it("recognises a formatter error", () => {
            const result: AiResult = {error: "boom"};
            expect(isErrorResult(result)).toBeTrue();
            expect(isDetectionResult(result)).toBeFalse();
            expect(isHeadsResult(result)).toBeFalse();
        });
    });
});

import {
    AiAvailableModelsMessage,
    AiResult,
    isDetectionResult,
    isErrorResult,
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
        it("recognises _format_detections output", () => {
            const result: AiResult = {
                detections: [
                    {
                        label: 0,
                        confidence: 0.87,
                        bbox: {xmin: 0.1, ymin: 0.2, xmax: 0.4, ymax: 0.8},
                    },
                ],
                count: 1,
            };
            expect(isDetectionResult(result)).toBeTrue();
            expect(isKeypointsResult(result)).toBeFalse();
            expect(isErrorResult(result)).toBeFalse();
        });

        it("recognises _format_keypoints output", () => {
            const result: AiResult = {
                keypoints: [{x: 0.5, y: 0.5, confidence: 0.9}],
                count: 1,
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

        it("recognises _format_predictions output", () => {
            const result: AiResult = {
                predictions: [{class: 3, confidence: 0.6}],
                count: 1,
            };
            expect(isPredictionsResult(result)).toBeTrue();
        });

        it("recognises a formatter error", () => {
            const result: AiResult = {error: "boom"};
            expect(isErrorResult(result)).toBeTrue();
            expect(isDetectionResult(result)).toBeFalse();
        });
    });
});

/**
 * Raw JPEG bytes delivered over the binary CBOR camera topic.
 * Pinned to ArrayBuffer (not ArrayBufferLike) so the frames can be handed
 * straight to the Blob constructor.
 */
export type JpegBytes = Uint8Array<ArrayBuffer>;

/**
 * AI vision interfaces for the OAK-D Lite camera node.
 *
 * These mirror the payloads published by `ros_packages/camera/oak_d_lite/stereo.py`
 * in pib-backend (branch `ai_cam_topics`). The node dispatches on the *runtime*
 * DepthAI output object, not on the model's declared type, so the result shape
 * is discriminated here by its own keys rather than by `AiDetectionMessage.type`.
 */

/** Bounding box in normalized coordinates (0-1) */
export interface BoundingBox {
    xmin: number;
    ymin: number;
    xmax: number;
    ymax: number;
}

/**
 * A single keypoint in normalized coordinates. `confidence` is omitted when the
 * parser provides none (DepthAI reports -1 for those).
 */
export interface Keypoint {
    x: number;
    y: number;
    confidence?: number;
}

/**
 * RLE-encoded segmentation mask, as produced by `rle_encode()` in stereo.py.
 * `runs[i]` repetitions of `values[i]`, row-major over `shape`.
 */
export interface SegmentationMaskRLE {
    runs: number[];
    values: number[];
    shape: number[];
}

/** One detection. Pose models add keypoints to the same structure. */
export interface Detection {
    label: number;
    confidence: number;
    bbox: BoundingBox;
    keypoints?: Keypoint[];
}

/** A line segment from the M-LSD model. */
export interface Line {
    start: {x: number; y: number};
    end: {x: number; y: number};
    confidence: number;
}

/** `_format_detections`: native ImgDetections (detection, pose, segmentation). */
export interface DetectionResult {
    detections: Detection[];
    count: number;
    /** Frame-level instance mask, present only in `segmentation_mode: "mask"`. */
    mask_rle?: SegmentationMaskRLE;
}

/** `_format_keypoints`: a bare keypoint list, e.g. hand landmarks. */
export interface KeypointsResult {
    keypoints: Keypoint[];
    count: number;
}

/** `_format_lines` */
export interface LinesResult {
    lines: Line[];
    count: number;
}

/** `_format_predictions`: regression outputs, one number per prediction. */
export interface PredictionsResult {
    predictions: number[];
    count: number;
}

/** `_format_classifications` */
export interface ClassificationsResult {
    classes: string[];
    scores: number[];
    top_class: string;
    top_score: number;
}

/** A multi-head model (dai.MessageGroup): one formatted result per head. */
export interface HeadsResult {
    heads: Record<string, AiResult>;
}

/** Raw passthrough when the model output could not be parsed. */
export interface RawResult {
    raw?: string;
    raw_layers?: string[];
    type?: string;
}

/** Any formatter can fail and return this instead. */
export interface ErrorResult {
    error: string;
}

/** Every result payload the camera node can emit. */
export type AiResult =
    | DetectionResult
    | KeypointsResult
    | LinesResult
    | PredictionsResult
    | ClassificationsResult
    | HeadsResult
    | RawResult
    | ErrorResult;

/**
 * Model families declared in AVAILABLE_MODELS. Note that the payload shape does
 * not follow from this value, so prefer the guards below over switching on it.
 */
export type AiResultType =
    | "detection"
    | "pose"
    | "hand"
    | "instance-segmentation"
    | "gaze"
    | "lines";

/** A frame of inference output, from `camera/ai/detections`. */
export interface AiDetectionMessage {
    model: string;
    type: AiResultType | string;
    frame_id: number;
    timestamp_ns: number;
    latency_ms: number;
    result: AiResult;
}

export function isErrorResult(result: AiResult): result is ErrorResult {
    return typeof (result as ErrorResult)?.error === "string";
}

export function isDetectionResult(result: AiResult): result is DetectionResult {
    return Array.isArray((result as DetectionResult)?.detections);
}

export function isKeypointsResult(result: AiResult): result is KeypointsResult {
    return Array.isArray((result as KeypointsResult)?.keypoints);
}

export function isLinesResult(result: AiResult): result is LinesResult {
    return Array.isArray((result as LinesResult)?.lines);
}

export function isPredictionsResult(
    result: AiResult,
): result is PredictionsResult {
    return Array.isArray((result as PredictionsResult)?.predictions);
}

export function isClassificationsResult(
    result: AiResult,
): result is ClassificationsResult {
    const candidate = result as ClassificationsResult;
    return (
        typeof candidate?.top_class === "string" &&
        Array.isArray(candidate.classes)
    );
}

export function isHeadsResult(result: AiResult): result is HeadsResult {
    const heads = (result as HeadsResult)?.heads;
    return typeof heads === "object" && heads !== null && !Array.isArray(heads);
}

/** AI configuration published to `camera/ai/config`. */
export interface AiConfig {
    model?: string;
    confidence?: number;
    segmentation_mode?: "bbox" | "mask";
    segmentation_target_class?: number | null;
}

/**
 * Per-model metadata as it appears on the wire, keyed by model name in the
 * `camera/ai/available_models` payload.
 */
export interface AiModelInfoPayload {
    type: AiResultType | string;
    description: string;
    classes: number;
    slug: string;
}

/**
 * `camera/ai/available_models` is a plain object keyed by model name, e.g.
 * `{"yolov6n": {type, description, classes, slug}, ...}` — not a wrapper.
 */
export type AiAvailableModelsMessage = Record<string, AiModelInfoPayload>;

/** A model flattened for display, with its registry key folded in as `name`. */
export interface AiModelInfo extends AiModelInfoPayload {
    name: string;
}

/**
 * Flatten the keyed available-models payload into a list.
 *
 * The backend's registry order is deliberate (default model first, grouped by
 * family) and survives both json.dumps and JSON.parse for non-numeric keys, so
 * it is kept rather than re-sorted.
 */
export function toModelList(
    message: AiAvailableModelsMessage | null | undefined,
): AiModelInfo[] {
    if (!message || typeof message !== "object") return [];
    return Object.entries(message)
        .filter(([, info]) => info && typeof info === "object")
        .map(([name, info]) => ({name, ...info}));
}

/** `camera/ai/current_model`, published on the status timer. */
export interface AiCurrentModelMessage {
    name: string;
    type: AiResultType | string;
    description: string;
    classes: number;
    slug: string;
    /** Whether the AI branch of the pipeline is currently built. */
    active: boolean;
    loading: boolean;
    /** Non-null when the last model load failed. */
    error: string | null;
}

/** COCO class labels (80 classes) for common object detection models */
export const COCO_LABELS: Record<number, string> = {
    0: "person",
    1: "bicycle",
    2: "car",
    3: "motorcycle",
    4: "airplane",
    5: "bus",
    6: "train",
    7: "truck",
    8: "boat",
    9: "traffic light",
    10: "fire hydrant",
    11: "stop sign",
    12: "parking meter",
    13: "bench",
    14: "bird",
    15: "cat",
    16: "dog",
    17: "horse",
    18: "sheep",
    19: "cow",
    20: "elephant",
    21: "bear",
    22: "zebra",
    23: "giraffe",
    24: "backpack",
    25: "umbrella",
    26: "handbag",
    27: "tie",
    28: "suitcase",
    29: "frisbee",
    30: "skis",
    31: "snowboard",
    32: "sports ball",
    33: "kite",
    34: "baseball bat",
    35: "baseball glove",
    36: "skateboard",
    37: "surfboard",
    38: "tennis racket",
    39: "bottle",
    40: "wine glass",
    41: "cup",
    42: "fork",
    43: "knife",
    44: "spoon",
    45: "bowl",
    46: "banana",
    47: "apple",
    48: "sandwich",
    49: "orange",
    50: "broccoli",
    51: "carrot",
    52: "hot dog",
    53: "pizza",
    54: "donut",
    55: "cake",
    56: "chair",
    57: "couch",
    58: "potted plant",
    59: "bed",
    60: "dining table",
    61: "toilet",
    62: "tv",
    63: "laptop",
    64: "mouse",
    65: "remote",
    66: "keyboard",
    67: "cell phone",
    68: "microwave",
    69: "oven",
    70: "toaster",
    71: "sink",
    72: "refrigerator",
    73: "book",
    74: "clock",
    75: "vase",
    76: "scissors",
    77: "teddy bear",
    78: "hair drier",
    79: "toothbrush",
};

/** Get label name for a class ID */
export function getLabelName(
    classId: number,
    labels: Record<number, string> = COCO_LABELS,
): string {
    return labels[classId] ?? `class_${classId}`;
}

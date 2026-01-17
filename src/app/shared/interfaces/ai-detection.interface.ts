/**
 * AI Detection interfaces for OAK-D Lite vision processing
 * Based on ROS_TOPICS.md and PLAN_AI_IMAGE_WEBSOCKET.md
 */

/** Bounding box in normalized coordinates (0-1) */
export interface BoundingBox {
    xmin: number;
    ymin: number;
    xmax: number;
    ymax: number;
}

/** Single detection result */
export interface Detection {
    label: number;
    confidence: number;
    bbox: BoundingBox;
}

/** Classification result */
export interface Classification {
    class_id: number;
    confidence: number;
}

/** Keypoint for pose estimation */
export interface Keypoint {
    id: number;
    x: number;
    y: number;
    confidence: number;
}

/** Segmentation bounding box with class info */
export interface SegmentationBBox {
    class_id: number;
    bbox: BoundingBox;
    pixel_count: number;
    coverage: number;
}

/** RLE-encoded segmentation mask */
export interface SegmentationMaskRLE {
    size: [number, number];
    counts: number[];
}

/** Detection result payload */
export interface DetectionResult {
    detections: Detection[];
    count: number;
}

/** Classification result payload */
export interface ClassificationResult {
    classifications: Classification[];
}

/** Segmentation result in bbox mode */
export interface SegmentationBBoxResult {
    mode: 'bbox';
    image_size: [number, number];
    classes_detected: number[];
    num_classes: number;
    bboxes: SegmentationBBox[];
    count: number;
}

/** Segmentation result in mask mode (RLE encoded) */
export interface SegmentationMaskResult {
    mode: 'mask';
    image_size: [number, number];
    target_class: number;
    target_bbox: BoundingBox;
    mask_rle: SegmentationMaskRLE;
    pixel_count: number;
}

/** Pose estimation result */
export interface PoseResult {
    keypoints: Keypoint[];
    num_keypoints: number;
    detected_count: number;
}

/** AI detection message types */
export type AiResultType = 'detection' | 'classification' | 'segmentation' | 'pose';

/** Base AI detection message */
export interface AiDetectionMessage {
    model: string;
    type: AiResultType;
    frame_id: number;
    timestamp_ns: number;
    latency_ms: number;
    result: DetectionResult | ClassificationResult | SegmentationBBoxResult | SegmentationMaskResult | PoseResult;
}

/** AI configuration for publishing to /ai/config */
export interface AiConfig {
    model?: string;
    confidence?: number;
    segmentation_mode?: 'bbox' | 'mask';
    segmentation_target_class?: number;
}

/** AI model metadata from /ai/available_models */
export interface AiModelInfo {
    name: string;
    type: AiResultType;
    description?: string;
    num_classes?: number;
    input_size?: [number, number];
}

/** Available models response from /ai/available_models */
export interface AiAvailableModelsMessage {
    models: AiModelInfo[];
}

/** Current model info from /ai/current_model */
export interface AiCurrentModelMessage {
    model: string;
    type: AiResultType;
    active: boolean;
    confidence: number;
}

/** COCO class labels (80 classes) for common object detection models */
export const COCO_LABELS: Record<number, string> = {
    0: 'person',
    1: 'bicycle',
    2: 'car',
    3: 'motorcycle',
    4: 'airplane',
    5: 'bus',
    6: 'train',
    7: 'truck',
    8: 'boat',
    9: 'traffic light',
    10: 'fire hydrant',
    11: 'stop sign',
    12: 'parking meter',
    13: 'bench',
    14: 'bird',
    15: 'cat',
    16: 'dog',
    17: 'horse',
    18: 'sheep',
    19: 'cow',
    20: 'elephant',
    21: 'bear',
    22: 'zebra',
    23: 'giraffe',
    24: 'backpack',
    25: 'umbrella',
    26: 'handbag',
    27: 'tie',
    28: 'suitcase',
    29: 'frisbee',
    30: 'skis',
    31: 'snowboard',
    32: 'sports ball',
    33: 'kite',
    34: 'baseball bat',
    35: 'baseball glove',
    36: 'skateboard',
    37: 'surfboard',
    38: 'tennis racket',
    39: 'bottle',
    40: 'wine glass',
    41: 'cup',
    42: 'fork',
    43: 'knife',
    44: 'spoon',
    45: 'bowl',
    46: 'banana',
    47: 'apple',
    48: 'sandwich',
    49: 'orange',
    50: 'broccoli',
    51: 'carrot',
    52: 'hot dog',
    53: 'pizza',
    54: 'donut',
    55: 'cake',
    56: 'chair',
    57: 'couch',
    58: 'potted plant',
    59: 'bed',
    60: 'dining table',
    61: 'toilet',
    62: 'tv',
    63: 'laptop',
    64: 'mouse',
    65: 'remote',
    66: 'keyboard',
    67: 'cell phone',
    68: 'microwave',
    69: 'oven',
    70: 'toaster',
    71: 'sink',
    72: 'refrigerator',
    73: 'book',
    74: 'clock',
    75: 'vase',
    76: 'scissors',
    77: 'teddy bear',
    78: 'hair drier',
    79: 'toothbrush',
};

/** Get label name for a class ID */
export function getLabelName(classId: number, labels: Record<number, string> = COCO_LABELS): string {
    return labels[classId] ?? `class_${classId}`;
}

import {
    Component,
    ElementRef,
    OnDestroy,
    OnInit,
    ViewChild,
    AfterViewInit,
    ChangeDetectionStrategy,
} from "@angular/core";
import {FormControl, FormsModule, ReactiveFormsModule} from "@angular/forms";
import {Observable, Subject, map, takeUntil} from "rxjs";
import {CameraSettings} from "../shared/types/camera-settings";
import {CameraService} from "../shared/services/camera.service";
import {
    NgbDropdown,
    NgbDropdownToggle,
    NgbDropdownMenu,
    NgbDropdownButtonItem,
    NgbDropdownItem,
} from "@ng-bootstrap/ng-bootstrap/dropdown";
import {NgbPopover} from "@ng-bootstrap/ng-bootstrap/popover";
import {HorizontalSliderComponent} from "../sliders/horizontal-slider/horizontal-slider.component";
import {
    AiDetectionMessage,
    AiModelInfo,
    AiCurrentModelMessage,
    AiResult,
    ClassificationsResult,
    Detection,
    JpegBytes,
    Keypoint,
    Line,
    getLabelName,
    isClassificationsResult,
    isDetectionResult,
    isErrorResult,
    isHeadsResult,
    isKeypointsResult,
    isLinesResult,
    isPredictionsResult,
    toModelList,
} from "../shared/interfaces/ai-detection.interface";
import {
    ImuData,
    ImuFrequency,
    VALID_IMU_FREQUENCIES,
    quaternionToEuler,
    radToDeg,
} from "../shared/interfaces/imu-data.interface";

@Component({
    selector: "app-camera",
    templateUrl: "./camera.component.html",
    styleUrls: ["./camera.component.scss"],
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [
        ReactiveFormsModule,
        FormsModule,
        NgbDropdown,
        NgbDropdownToggle,
        NgbDropdownMenu,
        NgbDropdownButtonItem,
        NgbDropdownItem,
        NgbPopover,
        HorizontalSliderComponent,
    ],
})
export class CameraComponent implements OnInit, OnDestroy, AfterViewInit {
    /** Keypoints below this confidence are too noisy to be worth drawing. */
    private static readonly KEYPOINT_MIN_CONFIDENCE = 0.3;
    /** How long to wait for a binary frame before requesting the base64 stream. */
    private static readonly BASE64_FALLBACK_DELAY_MS = 3000;

    @ViewChild("videobox") videoBox?: ElementRef;
    @ViewChild("refreshRate") refreshRateSlider!: ElementRef;
    @ViewChild("qualityFactor") qualityFactorSlider!: ElementRef;
    @ViewChild("cameraCanvas") cameraCanvas!: ElementRef<HTMLCanvasElement>;
    @ViewChild("aiOverlayCanvas")
    aiOverlayCanvas?: ElementRef<HTMLCanvasElement>;

    private destroy$ = new Subject<void>();

    qualityReceiver$!: Observable<number[]>;
    refreshRateReceiver$!: Observable<number[]>;
    isLoading = false;

    // Camera controls
    toggleCamera = new FormControl(false);
    cameraActiveIcon =
        "M880-275 720-435v111L244-800h416q24 0 42 18t18 42v215l160-160v410ZM848-27 39-836l42-42L890-69l-42 42ZM159-800l561 561v19q0 24-18 42t-42 18H140q-24 0-42-18t-18-42v-520q0-24 18-42t42-18h19Z";
    placeholderImage = "../../assets/camera-placeholder.jpg";
    /** base64 fallback frame, used until the CBOR stream delivers its first frame */
    imageSrc!: string;
    /** true once a binary CBOR frame has arrived; switches rendering to the canvas */
    cborActive = false;
    private cborSubscribed = false;
    private base64FallbackActive = false;
    private base64FallbackTimer?: ReturnType<typeof setTimeout>;
    private aiSubscribed = false;
    private imuSubscribed = false;

    // AI controls
    toggleAi = new FormControl(false);
    aiEnabled = false;
    availableModels: AiModelInfo[] = [];
    currentModel: AiCurrentModelMessage | null = null;
    latestDetection: AiDetectionMessage | null = null;

    // IMU controls
    toggleImu = new FormControl(false);
    imuEnabled = false;
    imuData: ImuData | null = null;
    imuFrequency: ImuFrequency = 100;
    readonly imuFrequencies: ImuFrequency[] = [...VALID_IMU_FREQUENCIES];
    orientation = {roll: 0, pitch: 0, yaw: 0};

    cameraSettings: CameraSettings | undefined;
    selectedSize!: string;

    // Canvas context for drawing
    private cameraCtx: CanvasRenderingContext2D | null = null;
    private aiCtx: CanvasRenderingContext2D | null = null;
    private currentBlobUrl: string | null = null;

    constructor(private cameraService: CameraService) {
        this.subscribeCameraSettings();
    }

    ngOnInit(): void {
        this.subscribeCameraReseiver();
        this.imageSrc = this.placeholderImage;
        this.cameraService.cameraReciver$
            .pipe(takeUntil(this.destroy$))
            .subscribe((message) => {
                if (message.startsWith("Camera not available")) {
                    this.imageSrc = "../../assets/camera-error-image.svg";
                    return;
                }
                this.imageSrc = "data:image/jpeg;base64," + message;
            });
        this.qualityReceiver$ =
            this.cameraService.rosCameraQualityFactorReceiver.pipe(
                map((n) => [n]),
            );
        this.refreshRateReceiver$ =
            this.cameraService.rosCameraTimerPeriodReceiver.pipe(
                map((n) => [n]),
            );

        // Subscribe to AI available models
        this.cameraService.aiAvailableModelsReceiver$
            .pipe(takeUntil(this.destroy$))
            .subscribe((models) => {
                // The topic carries an object keyed by model name, so it has to
                // be flattened into a list before the dropdown can render it.
                this.availableModels = toModelList(models);
            });

        // Subscribe to current AI model
        this.cameraService.aiCurrentModelReceiver$
            .pipe(takeUntil(this.destroy$))
            .subscribe((model) => {
                this.currentModel = model;
            });
    }

    ngAfterViewInit(): void {
        // Both canvases are always mounted, so their contexts resolve here once.
        if (this.cameraCanvas) {
            this.cameraCtx = this.cameraCanvas.nativeElement.getContext("2d");
        }
        if (this.aiOverlayCanvas) {
            this.aiCtx = this.aiOverlayCanvas.nativeElement.getContext("2d");
        }
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
        this.stopCamera();
        // Only tear down what was actually started; the AI/IMU topics do not
        // exist until they are first subscribed.
        if (this.aiEnabled) {
            this.stopAiDetection();
        }
        if (this.imuEnabled) {
            this.stopImu();
        }
        this.cameraSettings!.isActive = false;

        // Clean up blob URL
        if (this.currentBlobUrl) {
            URL.revokeObjectURL(this.currentBlobUrl);
        }
    }

    // ==================== Camera Methods ====================

    setSize(
        width: number,
        height: number,
        resolution: string,
        publish: boolean = true,
    ) {
        this.cameraSettings!.resX = width;
        this.cameraSettings!.resY = height;

        this.videoBox?.nativeElement.style.setProperty(
            "max-height",
            height + "px",
        );
        this.cameraSettings!.resolution = resolution;
        this.selectedSize = height + "px" + "(" + resolution + ")";
        if (publish) {
            this.isLoading = true;
            this.cameraService.setPreviewSize(width, height);
            setTimeout(() => {
                this.isLoading = false;
            }, 1500);
        }
        this.publishCameraSettings(this.cameraSettings!);

        // Update canvas sizes
        this.updateCanvasSizes(width, height);
    }

    private updateCanvasSizes(width: number, height: number): void {
        if (this.cameraCanvas) {
            this.cameraCanvas.nativeElement.width = width;
            this.cameraCanvas.nativeElement.height = height;
        }
        if (this.aiOverlayCanvas) {
            this.aiOverlayCanvas.nativeElement.width = width;
            this.aiOverlayCanvas.nativeElement.height = height;
        }
    }

    startCamera() {
        this.cameraService.startCamera();
        if (!this.cborSubscribed) {
            this.cborSubscribed = true;
            // Binary CBOR stream; the first frame switches rendering to the canvas
            this.cameraService.cameraCborReceiver$
                .pipe(takeUntil(this.destroy$))
                .subscribe((jpegData: JpegBytes) => this.onCborFrame(jpegData));
        }
        // Request the base64 stream only if the binary one stays silent.
        this.clearBase64FallbackTimer();
        this.base64FallbackTimer = setTimeout(() => {
            this.base64FallbackTimer = undefined;
            if (!this.cborActive) {
                this.base64FallbackActive = true;
                this.cameraService.startBase64Fallback();
            }
        }, CameraComponent.BASE64_FALLBACK_DELAY_MS);
    }

    stopCamera() {
        this.clearBase64FallbackTimer();
        this.base64FallbackActive = false;
        this.cameraService.stopCamera();
        this.clearCanvas();
        this.cborActive = false;
        this.imageSrc = this.placeholderImage;
    }

    private onCborFrame(jpegData: JpegBytes): void {
        this.cborActive = true;
        this.clearBase64FallbackTimer();
        if (this.base64FallbackActive) {
            this.base64FallbackActive = false;
            this.cameraService.stopBase64Fallback();
        }
        this.renderJpegToCanvas(jpegData);
    }

    private clearBase64FallbackTimer(): void {
        if (this.base64FallbackTimer !== undefined) {
            clearTimeout(this.base64FallbackTimer);
            this.base64FallbackTimer = undefined;
        }
    }

    /** Keeps the upstream base64 stream flowing as a fallback for backends without CBOR. */
    subscribeCameraReseiver() {
        this.cameraService.subscribeCameraReseiver();
    }

    /**
     * Render raw JPEG bytes to canvas (CBOR binary stream)
     */
    private renderJpegToCanvas(jpegData: JpegBytes): void {
        if (!this.cameraCtx) return;

        // Clean up previous blob URL
        if (this.currentBlobUrl) {
            URL.revokeObjectURL(this.currentBlobUrl);
        }

        // Create blob from JPEG bytes
        const blob = new Blob([jpegData], {type: "image/jpeg"});
        this.currentBlobUrl = URL.createObjectURL(blob);

        // Load and draw image
        const img = new Image();
        img.onload = () => {
            if (this.cameraCtx && this.cameraCanvas) {
                const canvas = this.cameraCanvas.nativeElement;
                this.cameraCtx.drawImage(
                    img,
                    0,
                    0,
                    canvas.width,
                    canvas.height,
                );
            }
        };
        img.src = this.currentBlobUrl;
    }

    private clearCanvas(): void {
        if (this.cameraCtx && this.cameraCanvas) {
            const canvas = this.cameraCanvas.nativeElement;
            this.cameraCtx.clearRect(0, 0, canvas.width, canvas.height);

            // Draw placeholder
            this.cameraCtx.fillStyle = "#1a1a2e";
            this.cameraCtx.fillRect(0, 0, canvas.width, canvas.height);
            this.cameraCtx.fillStyle = "#ffffff";
            this.cameraCtx.font = "20px Arial";
            this.cameraCtx.textAlign = "center";
            this.cameraCtx.fillText(
                "Camera Off",
                canvas.width / 2,
                canvas.height / 2,
            );
        }
    }

    toggleCameraState() {
        if (!this.cameraSettings!.isActive) {
            this.startCamera();
        } else {
            this.stopCamera();
        }
        this.cameraSettings!.isActive = !this.cameraSettings!.isActive;
        this.changeCameraIcon();
        this.publishCameraSettings(this.cameraSettings!);
    }

    changeCameraIcon() {
        if (this.cameraSettings!.isActive) {
            this.cameraActiveIcon =
                "M140-160q-24 0-42-18t-18-42v-520q0-24 18-42t42-18h520q24 0 42 18t18 42v215l160-160v410L720-435v215q0 24-18 42t-42 18H140Z";
        } else {
            this.cameraActiveIcon =
                "M880-275 720-435v111L244-800h416q24 0 42 18t18 42v215l160-160v410ZM848-27 39-836l42-42L890-69l-42 42ZM159-800l561 561v19q0 24-18 42t-42 18H140q-24 0-42-18t-18-42v-520q0-24 18-42t42-18h19Z";
        }
    }

    // ==================== AI Detection Methods ====================

    toggleAiState() {
        this.aiEnabled = !this.aiEnabled;
        if (this.aiEnabled) {
            this.startAiDetection();
        } else {
            this.stopAiDetection();
        }
    }

    startAiDetection() {
        this.cameraService.startAiDetection();

        if (this.aiSubscribed) return;
        this.aiSubscribed = true;
        this.cameraService.aiDetectionsReceiver$
            .pipe(takeUntil(this.destroy$))
            .subscribe((detection: AiDetectionMessage) => {
                this.latestDetection = detection;
                this.drawAiOverlay(detection);
            });
    }

    stopAiDetection() {
        this.cameraService.stopAiDetection();
        this.clearAiOverlay();
        this.latestDetection = null;
    }

    selectAiModel(modelName: string) {
        this.cameraService.setAiConfig({model: modelName});
    }

    /**
     * Draw AI detection bounding boxes on overlay canvas
     */
    private drawAiOverlay(detection: AiDetectionMessage): void {
        if (!this.aiCtx || !this.aiOverlayCanvas) return;

        const canvas = this.aiOverlayCanvas.nativeElement;
        this.aiCtx.clearRect(0, 0, canvas.width, canvas.height);
        if (detection.result) {
            this.drawResult(
                detection.result,
                canvas.width,
                canvas.height,
                detection.model,
            );
        }
    }

    /**
     * Draw one formatted result. The camera node picks a formatter from the
     * runtime DepthAI output type, so results are told apart by their keys,
     * and multi-head models nest one result per head.
     */
    private drawResult(
        result: AiResult,
        width: number,
        height: number,
        modelName: string,
    ): void {
        if (isErrorResult(result)) return;
        if (isHeadsResult(result)) {
            for (const head of Object.values(result.heads)) {
                this.drawResult(head, width, height, modelName);
            }
            return;
        }
        if (isDetectionResult(result)) {
            for (const det of result.detections) {
                this.drawBoundingBox(det, width, height, modelName);
                if (det.keypoints?.length) {
                    this.drawKeypoints(det.keypoints, width, height);
                }
            }
        } else if (isKeypointsResult(result)) {
            this.drawKeypoints(result.keypoints, width, height);
        } else if (isLinesResult(result)) {
            for (const line of result.lines) {
                this.drawLine(line, width, height);
            }
        } else if (isClassificationsResult(result)) {
            this.drawClassification(result);
        }
    }

    /** Show the top class of a classification in the top-left corner. */
    private drawClassification(result: ClassificationsResult): void {
        if (!this.aiCtx) return;

        const text = `${result.top_class} ${(result.top_score * 100).toFixed(
            0,
        )}%`;
        const padding = 4;
        this.aiCtx.font = "14px Arial";
        this.aiCtx.fillStyle = "rgba(0, 0, 0, 0.6)";
        this.aiCtx.fillRect(
            0,
            0,
            this.aiCtx.measureText(text).width + padding * 2,
            22,
        );
        this.aiCtx.fillStyle = "#ffffff";
        this.aiCtx.fillText(text, padding, 16);
    }

    /**
     * Draw keypoints as filled dots. Coordinates are normalized (0-1).
     */
    private drawKeypoints(
        keypoints: Keypoint[],
        canvasWidth: number,
        canvasHeight: number,
    ): void {
        if (!this.aiCtx) return;

        for (const kp of keypoints) {
            if (
                kp.confidence !== undefined &&
                kp.confidence < CameraComponent.KEYPOINT_MIN_CONFIDENCE
            ) {
                continue;
            }
            this.aiCtx.beginPath();
            this.aiCtx.arc(
                kp.x * canvasWidth,
                kp.y * canvasHeight,
                3,
                0,
                Math.PI * 2,
            );
            this.aiCtx.fillStyle = "#4ECDC4";
            this.aiCtx.fill();
        }
    }

    /**
     * Draw a detected line segment. Coordinates are normalized (0-1).
     */
    private drawLine(
        line: Line,
        canvasWidth: number,
        canvasHeight: number,
    ): void {
        if (!this.aiCtx) return;

        this.aiCtx.beginPath();
        this.aiCtx.moveTo(
            line.start.x * canvasWidth,
            line.start.y * canvasHeight,
        );
        this.aiCtx.lineTo(line.end.x * canvasWidth, line.end.y * canvasHeight);
        this.aiCtx.strokeStyle = "#FFD700";
        this.aiCtx.lineWidth = 2;
        this.aiCtx.stroke();
    }

    /**
     * Draw a single bounding box with label
     */
    private drawBoundingBox(
        detection: Detection,
        canvasWidth: number,
        canvasHeight: number,
        modelName: string,
    ): void {
        if (!this.aiCtx) return;

        const {bbox, label, confidence} = detection;

        // Convert normalized coordinates to pixel coordinates
        const x = bbox.xmin * canvasWidth;
        const y = bbox.ymin * canvasHeight;
        const width = (bbox.xmax - bbox.xmin) * canvasWidth;
        const height = (bbox.ymax - bbox.ymin) * canvasHeight;

        // Get color based on label
        const color = this.getLabelColor(label);

        // Draw bounding box
        this.aiCtx.strokeStyle = color;
        this.aiCtx.lineWidth = 2;
        this.aiCtx.strokeRect(x, y, width, height);

        // Draw label background
        const labelText = `${this.boxLabel(modelName, label)} ${(
            confidence * 100
        ).toFixed(0)}%`;
        this.aiCtx.font = "14px Arial";
        const textMetrics = this.aiCtx.measureText(labelText);
        const textHeight = 18;
        const padding = 4;

        this.aiCtx.fillStyle = color;
        this.aiCtx.fillRect(
            x,
            y - textHeight - padding,
            textMetrics.width + padding * 2,
            textHeight + padding,
        );

        // Draw label text
        this.aiCtx.fillStyle = "#ffffff";
        this.aiCtx.fillText(labelText, x + padding, y - padding - 2);
    }

    /**
     * Label text for a box. Single-class models (face, person) always report
     * label 0, which the COCO table would name "person", so they are named
     * after the model instead.
     */
    private boxLabel(modelName: string, label: number): string {
        const model = this.availableModels.find((m) => m.name === modelName);
        return model?.classes === 1 ? model.name : getLabelName(label);
    }

    /**
     * Get consistent color for a label ID
     */
    private getLabelColor(labelId: number): string {
        const colors = [
            "#FF6B6B",
            "#4ECDC4",
            "#45B7D1",
            "#96CEB4",
            "#FFEAA7",
            "#DDA0DD",
            "#98D8C8",
            "#F7DC6F",
            "#BB8FCE",
            "#85C1E9",
            "#F8B500",
            "#00CED1",
            "#FF69B4",
            "#32CD32",
            "#FFD700",
        ];
        return colors[labelId % colors.length];
    }

    private clearAiOverlay(): void {
        if (this.aiCtx && this.aiOverlayCanvas) {
            const canvas = this.aiOverlayCanvas.nativeElement;
            this.aiCtx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }

    getDetectionCount(): number {
        const result = this.latestDetection?.result;
        return result ? CameraComponent.countResult(result) : 0;
    }

    /** The error text from the last inference frame or one of its heads. */
    getDetectionError(): string | null {
        const result = this.latestDetection?.result;
        return result ? CameraComponent.findError(result) : null;
    }

    private static countResult(result: AiResult): number {
        if (isErrorResult(result)) return 0;
        if (isHeadsResult(result)) {
            return Object.values(result.heads).reduce(
                (sum, head) => sum + CameraComponent.countResult(head),
                0,
            );
        }
        if (isDetectionResult(result)) return result.detections.length;
        if (isKeypointsResult(result)) return result.keypoints.length;
        if (isLinesResult(result)) return result.lines.length;
        if (isPredictionsResult(result)) return result.predictions.length;
        if (isClassificationsResult(result)) return 1;
        return 0;
    }

    private static findError(result: AiResult): string | null {
        if (isErrorResult(result)) return result.error;
        if (isHeadsResult(result)) {
            for (const head of Object.values(result.heads)) {
                const error = CameraComponent.findError(head);
                if (error) return error;
            }
        }
        return null;
    }

    // ==================== IMU Methods ====================

    toggleImuState() {
        this.imuEnabled = !this.imuEnabled;
        if (this.imuEnabled) {
            this.startImu();
        } else {
            this.stopImu();
        }
    }

    startImu() {
        this.cameraService.startImuData();

        // Set initial frequency
        this.setImuFrequency();

        if (this.imuSubscribed) return;
        this.imuSubscribed = true;
        this.cameraService.imuDataReceiver$
            .pipe(takeUntil(this.destroy$))
            .subscribe((data: ImuData) => {
                this.imuData = data;

                // Calculate orientation from quaternion if available
                if (data.orientation) {
                    const euler = quaternionToEuler(data.orientation);
                    this.orientation = {
                        roll: radToDeg(euler.roll),
                        pitch: radToDeg(euler.pitch),
                        yaw: radToDeg(euler.yaw),
                    };
                }
            });
    }

    stopImu() {
        this.cameraService.stopImuData();
        this.imuData = null;
        this.orientation = {roll: 0, pitch: 0, yaw: 0};
    }

    setImuFrequency() {
        this.cameraService.setImuConfig({frequency: this.imuFrequency});
    }

    // ==================== Settings Methods ====================

    updateRefreshRateLabel(sliderNumber: number) {
        this.cameraSettings!.refreshRate = sliderNumber;
    }

    updateQualityFactorLabel(sliderNumber: number) {
        this.cameraSettings!.qualityFactor = sliderNumber;
    }

    removeCssClass() {
        const videoSettingsButton = document.getElementById("videosettings");
        videoSettingsButton?.classList.remove("showPopover");
    }

    addCssClass() {
        const videoSettingsButton = document.getElementById("videosettings");
        videoSettingsButton?.classList.add("showPopover");
    }

    subscribeCameraSettings() {
        this.cameraService.cameraSettings.subscribe(
            (message: CameraSettings) => {
                this.cameraSettings = message;
            },
        );
    }

    publishCameraSettings(cameraSettings: CameraSettings) {
        this.cameraService.publishCameraSettings(cameraSettings);
    }

    qualityControlPublish = (formControlValue: number) => {
        this.cameraService.qualityControlPublish(formControlValue);
    };

    refreshRatePublish = (formControlValue: number) => {
        this.cameraService.refreshRatePublish(formControlValue);
    };
}

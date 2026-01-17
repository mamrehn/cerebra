import {
    Component,
    ElementRef,
    OnDestroy,
    OnInit,
    ViewChild,
    AfterViewInit,
} from "@angular/core";
import {FormControl} from "@angular/forms";
import {Observable, Subject, map, takeUntil} from "rxjs";
import {CameraSettings} from "../shared/types/camera-settings";
import {CameraService} from "../shared/services/camera.service";
import {
    AiDetectionMessage,
    AiModelInfo,
    AiCurrentModelMessage,
    Detection,
    DetectionResult,
    getLabelName,
    COCO_LABELS,
} from "../shared/interfaces/ai-detection.interface";
import {
    ImuData,
    quaternionToEuler,
    radToDeg,
} from "../shared/interfaces/imu-data.interface";

@Component({
    selector: "app-camera",
    templateUrl: "./camera.component.html",
    styleUrls: ["./camera.component.scss"],
})
export class CameraComponent implements OnInit, OnDestroy, AfterViewInit {
    @ViewChild("videobox") videoBox?: ElementRef;
    @ViewChild("refreshRate") refreshRateSlider!: ElementRef;
    @ViewChild("qualityFactor") qualityFactorSlider!: ElementRef;
    @ViewChild("cameraCanvas") cameraCanvas!: ElementRef<HTMLCanvasElement>;
    @ViewChild("aiOverlayCanvas") aiOverlayCanvas?: ElementRef<HTMLCanvasElement>;

    private destroy$ = new Subject<void>();

    qualityReceiver$!: Observable<number[]>;
    refreshRateReceiver$!: Observable<number[]>;
    isLoading = false;

    // Camera controls
    toggleCamera = new FormControl(false);
    cameraActiveIcon =
        "M880-275 720-435v111L244-800h416q24 0 42 18t18 42v215l160-160v410ZM848-27 39-836l42-42L890-69l-42 42ZM159-800l561 561v19q0 24-18 42t-42 18H140q-24 0-42-18t-18-42v-520q0-24 18-42t42-18h19Z";
    placeholderImage = "../../assets/camera-placeholder.jpg";

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
    imuFrequency: 25 | 50 | 100 | 200 | 250 = 100;
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
                if (models) {
                    this.availableModels = models.models;
                }
            });

        // Subscribe to current AI model
        this.cameraService.aiCurrentModelReceiver$
            .pipe(takeUntil(this.destroy$))
            .subscribe((model) => {
                this.currentModel = model;
            });
    }

    ngAfterViewInit(): void {
        // Initialize camera canvas context
        if (this.cameraCanvas) {
            this.cameraCtx = this.cameraCanvas.nativeElement.getContext("2d");
        }
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
        this.stopCamera();
        this.stopAiDetection();
        this.stopImu();
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

        // Subscribe to CBOR binary camera stream
        this.cameraService.cameraCborReceiver$
            .pipe(takeUntil(this.destroy$))
            .subscribe((jpegData: Uint8Array) => {
                this.renderJpegToCanvas(jpegData);
            });
    }

    stopCamera() {
        this.cameraService.stopCamera();
        this.clearCanvas();
    }

    /**
     * Render raw JPEG bytes to canvas (CBOR binary stream)
     */
    private renderJpegToCanvas(jpegData: Uint8Array): void {
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
                this.cameraCtx.drawImage(img, 0, 0, canvas.width, canvas.height);
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

        // Initialize AI overlay canvas context
        setTimeout(() => {
            if (this.aiOverlayCanvas) {
                this.aiCtx = this.aiOverlayCanvas.nativeElement.getContext("2d");
            }
        }, 100);

        // Subscribe to AI detections
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

        if (detection.type === "detection" && detection.result) {
            const result = detection.result as DetectionResult;
            for (const det of result.detections) {
                this.drawBoundingBox(det, canvas.width, canvas.height);
            }
        }
    }

    /**
     * Draw a single bounding box with label
     */
    private drawBoundingBox(
        detection: Detection,
        canvasWidth: number,
        canvasHeight: number,
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
        const labelText = `${getLabelName(label)} ${(confidence * 100).toFixed(0)}%`;
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
     * Get consistent color for a label ID
     */
    private getLabelColor(labelId: number): string {
        const colors = [
            "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7",
            "#DDA0DD", "#98D8C8", "#F7DC6F", "#BB8FCE", "#85C1E9",
            "#F8B500", "#00CED1", "#FF69B4", "#32CD32", "#FFD700",
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
        if (!this.latestDetection || this.latestDetection.type !== "detection") {
            return 0;
        }
        const result = this.latestDetection.result as DetectionResult;
        return result.count || result.detections?.length || 0;
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

        // Subscribe to IMU data
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

        // Set initial frequency
        this.setImuFrequency();
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

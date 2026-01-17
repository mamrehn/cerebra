import {CameraSettings} from "../types/camera-settings";
import {ApiService} from "./api.service";
import {UrlConstants} from "../../shared/services/url.constants";
import {BehaviorSubject, Subject, catchError, throwError} from "rxjs";
import {Injectable} from "@angular/core";
import {RosService} from "./ros-service/ros.service";
import {
    AiDetectionMessage,
    AiConfig,
    AiAvailableModelsMessage,
    AiCurrentModelMessage,
} from "../interfaces/ai-detection.interface";
import {ImuData, Vector3Stamped, ImuConfig} from "../interfaces/imu-data.interface";

@Injectable({
    providedIn: "root",
})
export class CameraService {
    qualityFactor!: number;
    resX!: number;
    resY!: number;
    timerPeriod!: number;

    constructor(
        private rosService: RosService,
        private apiService: ApiService,
    ) {
        this.getCameraSettings();
        this.subscribeCameraQualityFactorReceiver();
        this.subscribeCameraPreviewSizeReceiver();
        this.subscribeCameraTimerPeriodReceiver();
    }
    rosCameraQualityFactorReceiver =
        this.rosService.cameraQualityFactorReceiver$;
    rosCameraTimerPeriodReceiver = this.rosService.cameraTimerPeriodReceiver$;

    // CBOR binary camera stream (Uint8Array of raw JPEG bytes)
    cameraCborReceiver$ = this.rosService.cameraCborReceiver$;

    // AI Detection receivers
    aiDetectionsReceiver$ = this.rosService.aiDetectionsReceiver$;
    aiAvailableModelsReceiver$ = this.rosService.aiAvailableModelsReceiver$;
    aiCurrentModelReceiver$ = this.rosService.aiCurrentModelReceiver$;

    // IMU receivers
    imuDataReceiver$ = this.rosService.imuDataReceiver$;
    imuAccelerometerReceiver$ = this.rosService.imuAccelerometerReceiver$;
    imuGyroscopeReceiver$ = this.rosService.imuGyroscopeReceiver$;

    cameraSettings: BehaviorSubject<CameraSettings> =
        new BehaviorSubject<CameraSettings>({} as CameraSettings);

    updateCameraSettings(updateCameraSettings: CameraSettings) {
        this.apiService
            .put(UrlConstants.CAMERA, updateCameraSettings)
            .pipe(
                catchError((err) => {
                    return throwError(() => {
                        console.log(err);
                    });
                }),
            )
            .subscribe(() => {
                return;
            });
    }

    getCameraSettings() {
        this.apiService
            .get(UrlConstants.CAMERA)
            .pipe(
                catchError((err) => {
                    return throwError(() => {
                        console.log(err);
                    });
                }),
            )
            .subscribe((response) => {
                this.cameraSettings.next(response);
            });
    }

    subscribeCameraQualityFactorReceiver() {
        this.rosService.cameraQualityFactorReceiver$.subscribe(
            (message: number) => {
                if (
                    this.cameraSettings.getValue().qualityFactor != message &&
                    this.cameraSettings.getValue().qualityFactor != undefined
                ) {
                    this.cameraSettings.getValue().qualityFactor = message;
                    this.publishCameraSettings(this.cameraSettings.getValue());
                }
            },
        );
    }

    subscribeCameraPreviewSizeReceiver() {
        this.rosService.cameraPreviewSizeReceiver$.subscribe(
            (message: number[]) => {
                if (
                    message[0] != this.cameraSettings.getValue().resX &&
                    message[1] != this.cameraSettings.getValue().resY &&
                    message[0] != 0 &&
                    message[1] != 0 &&
                    this.cameraSettings.getValue().resX != undefined &&
                    this.cameraSettings.getValue().resY != undefined
                ) {
                    this.cameraSettings.getValue().resX = message[0];
                    this.cameraSettings.getValue().resY = message[1];
                    this.publishCameraSettings(this.cameraSettings.getValue());
                }
            },
        );
    }

    subscribeCameraTimerPeriodReceiver() {
        this.rosService.cameraTimerPeriodReceiver$.subscribe(
            (message: number) => {
                if (
                    this.cameraSettings.getValue().refreshRate != message &&
                    this.cameraSettings.getValue().refreshRate != undefined
                ) {
                    this.cameraSettings.getValue().refreshRate = message;
                    this.publishCameraSettings(this.cameraSettings.getValue());
                }
            },
        );
    }

    qualityControlPublish(formControlValue: number) {
        this.cameraSettings.getValue().qualityFactor = formControlValue;
        this.rosService.setQualityFactor(formControlValue);
        this.publishCameraSettings(this.cameraSettings.getValue());
    }

    refreshRatePublish = (formControlValue: number) => {
        this.cameraSettings.getValue().refreshRate = formControlValue;
        this.rosService.setTimerPeriod(formControlValue);
        this.publishCameraSettings(this.cameraSettings.getValue());
    };

    setPreviewSize(width: number, height: number) {
        this.rosService.setPreviewSize(width, height);
    }

    // ==================== CBOR Camera (Binary JPEG) ====================

    /**
     * Start CBOR camera stream (binary JPEG, faster than base64)
     */
    startCamera() {
        this.rosService.subscribeCameraCborTopic();
    }

    /**
     * Stop CBOR camera stream
     */
    stopCamera() {
        this.rosService.unsubscribeCameraCborTopic();
    }

    // ==================== AI Detection ====================

    /**
     * Start AI detection stream (on-demand: backend starts inference when subscribed)
     */
    startAiDetection() {
        this.rosService.subscribeAiDetectionsTopic();
    }

    /**
     * Stop AI detection stream
     */
    stopAiDetection() {
        this.rosService.unsubscribeAiDetectionsTopic();
    }

    /**
     * Set AI configuration (model, confidence threshold, etc.)
     */
    setAiConfig(config: AiConfig) {
        this.rosService.publishAiConfig(config);
    }

    // ==================== IMU ====================

    /**
     * Start full IMU data stream (accelerometer + gyroscope)
     */
    startImuData() {
        this.rosService.subscribeImuDataTopic();
    }

    /**
     * Stop IMU data stream
     */
    stopImuData() {
        this.rosService.unsubscribeImuDataTopic();
    }

    /**
     * Set IMU configuration (frequency: 25, 50, 100, 200, 250 Hz)
     */
    setImuConfig(config: ImuConfig) {
        this.rosService.publishImuConfig(config);
    }

    publishCameraSettings(cameraSettings: CameraSettings) {
        this.cameraSettings.next(cameraSettings);
        this.updateCameraSettings(cameraSettings);
    }
}

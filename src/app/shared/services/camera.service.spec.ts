import {TestBed} from "@angular/core/testing";
import {JpegBytes} from "../interfaces/ai-detection.interface";

import {HttpClientTestingModule} from "@angular/common/http/testing";
import {ApiService} from "./api.service";
import {CameraService} from "./camera.service";
import {CameraSettings} from "../types/camera-settings";
import {BehaviorSubject} from "rxjs";
import {HttpClient} from "@angular/common/http";
import {RosService} from "./ros-service/ros.service";

describe("CameraService", () => {
    let service: CameraService;
    let apiService: ApiService;
    let rosService: RosService;

    const updateCameraSettings = new CameraSettings("HD", 0.5, 50, 1280, 720);
    const cameraSettings = new CameraSettings("SD", 0.1, 80, 640, 480);
    const behaviorSubjectOfCameraSettings = new BehaviorSubject<any>(
        cameraSettings,
    );
    const behaviorSubjectOfUpdatedCameraSettings = new BehaviorSubject<any>(
        updateCameraSettings,
    );

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [CameraService, ApiService, HttpClient, RosService],
            imports: [HttpClientTestingModule],
        });
        service = TestBed.inject(CameraService);
        apiService = TestBed.inject(ApiService);
        rosService = TestBed.inject(RosService);
    });

    it("should be created", () => {
        expect(service).toBeTruthy();
    });

    it("should return camera settings", () => {
        const spyOnGetCameraSettings = spyOn(apiService, "get").and.returnValue(
            behaviorSubjectOfCameraSettings,
        );
        service.getCameraSettings();
        expect(spyOnGetCameraSettings).toHaveBeenCalled();
        expect(service.cameraSettings.getValue()).toEqual(cameraSettings);
    });

    it("should retrun updated camera settings", () => {
        const spyOnPutCameraSettings = spyOn(apiService, "put").and.returnValue(
            behaviorSubjectOfUpdatedCameraSettings,
        );
        service.publishCameraSettings(updateCameraSettings);
        expect(spyOnPutCameraSettings).toHaveBeenCalled();
        expect(service.cameraSettings.getValue()).toEqual(updateCameraSettings);
    });

    it("should return camera quality factor over ros topic", () => {
        service.cameraSettings.next(updateCameraSettings);
        service.subscribeCameraQualityFactorReceiver();
        rosService.cameraQualityFactorReceiver$.next(40);
        expect(service.cameraSettings.getValue().qualityFactor).toBe(40);
    });

    it("should return camera preview size over ros topic", () => {
        service.cameraSettings.next(updateCameraSettings);
        service.subscribeCameraPreviewSizeReceiver();
        rosService.cameraPreviewSizeReceiver$.next([620, 480]);
        expect(service.cameraSettings.getValue().resX).toBe(620);
        expect(service.cameraSettings.getValue().resY).toBe(480);
    });

    it("should return camera refreshRate over ros topic", () => {
        service.cameraSettings.next(updateCameraSettings);
        service.subscribeCameraTimerPeriodReceiver();
        rosService.cameraTimerPeriodReceiver$.next(0.5);
        expect(service.cameraSettings.getValue().refreshRate).toBe(0.5);
    });

    it("should return camera imageString over ros topic", () => {
        service.subscribeCameraReseiver();
        let res: string | undefined;
        service.cameraReciver$.subscribe((response) => {
            res = response;
        });
        rosService.cameraReceiver$.next("TestString");
        expect(res).toBe("TestString");
    });

    it("omits client-only fields from the settings PUT", () => {
        // The backend's camera-settings schema rejects unknown fields, so an
        // `isActive` flag in the body makes the whole PUT fail with 400.
        const withViewState = new CameraSettings(
            "HD",
            0.5,
            50,
            1280,
            720,
            true,
        );
        const spyOnPut = spyOn(apiService, "put").and.returnValue(
            behaviorSubjectOfUpdatedCameraSettings,
        );

        service.updateCameraSettings(withViewState);

        const body = spyOnPut.calls.mostRecent().args[1];
        expect(Object.keys(body).sort()).toEqual([
            "qualityFactor",
            "refreshRate",
            "resX",
            "resY",
            "resolution",
        ]);
        expect("isActive" in body).toBeFalse();
    });

    it("startCamera requests only the binary stream", () => {
        const spyCbor = spyOn(rosService, "subscribeCameraCborTopic");
        const spyBase64 = spyOn(rosService, "subscribeCameraTopic");

        service.startCamera();

        expect(spyCbor).toHaveBeenCalledTimes(1);
        expect(spyBase64).not.toHaveBeenCalled();
    });

    it("should return camera CBOR binary data over ros topic", () => {
        let res: JpegBytes | undefined;
        service.cameraCborReceiver$.subscribe((response: JpegBytes) => {
            res = response;
        });
        const testData = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]); // JPEG magic bytes
        rosService.cameraCborReceiver$.next(testData);
        expect(res).toEqual(testData);
    });
});

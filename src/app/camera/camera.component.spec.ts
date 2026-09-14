import {
    ComponentFixture,
    TestBed,
    fakeAsync,
    tick,
} from "@angular/core/testing";
import {ReactiveFormsModule, FormsModule} from "@angular/forms";
import {CameraComponent} from "./camera.component";
import {RosService} from "../shared/services/ros-service/ros.service";
import {By} from "@angular/platform-browser";
import {NgbPopover} from "@ng-bootstrap/ng-bootstrap";
import {CameraService} from "../shared/services/camera.service";
import {ApiService} from "../shared/services/api.service";
import {HttpClientTestingModule} from "@angular/common/http/testing";
import {HorizontalSliderComponent} from "../sliders/horizontal-slider/horizontal-slider.component";

describe("CameraComponent", () => {
    let component: CameraComponent;
    let fixture: ComponentFixture<CameraComponent>;
    let rosService: RosService;
    let spyUnsubscribeCamera: jasmine.Spy<() => void>;
    let spyUnsubscribeCameraCbor: jasmine.Spy<() => void>;
    let cameraService: CameraService;

    beforeEach(async () => {
        TestBed.configureTestingModule({
            imports: [
                ReactiveFormsModule,
                FormsModule,
                NgbPopover,
                HttpClientTestingModule,
                CameraComponent,
                HorizontalSliderComponent,
            ],
            providers: [RosService, CameraService, ApiService],
        }).compileComponents();
        rosService = TestBed.inject(RosService);
        cameraService = TestBed.inject(CameraService);
        fixture = TestBed.createComponent(CameraComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
        spyUnsubscribeCamera = spyOn(rosService, "unsubscribeCameraTopic");
        spyUnsubscribeCameraCbor = spyOn(
            rosService,
            "unsubscribeCameraCborTopic",
        );
    });

    it("should create", () => {
        expect(component).toBeTruthy();
    });

    it("should subscribe to the message receiver when the component is instantiated", () => {
        const spy = spyOn(cameraService, "subscribeCameraReseiver");
        component.ngOnInit();
        expect(spy).toHaveBeenCalled();
    });

    it("should display an error image when receiving error messages from the backend", fakeAsync(() => {
        rosService.cameraReceiver$.next("Camera not available");
        tick(1000);
        expect(component.imageSrc).toMatch("../../assets/camera-error-image");
    }));

    it("setSize should send the size message via setPreviewSize method in rosService", fakeAsync(() => {
        spyOn(component, "setSize").and.callThrough();
        spyOn(rosService, "setPreviewSize");
        const width = 1920;
        const height = 1080;
        const resolution = "FHD";
        component.setSize(width, height, resolution);
        expect(component.selectedSize).toBe(height + "px(" + resolution + ")");
        expect(component.isLoading).toBeTrue();
        tick(1500);
        expect(component.isLoading).toBeFalse();
    }));

    it("should toggle the camera when i click on the camera icon", () => {
        const spyStartCamera = spyOn(component, "startCamera");
        const spyStopCamera = spyOn(component, "stopCamera");

        const toggleBtn = fixture.debugElement.query(By.css("#toggleCamera"));
        toggleBtn.nativeElement.click();
        expect(spyStartCamera).toHaveBeenCalled();
        toggleBtn.nativeElement.click();
        expect(spyStopCamera).toHaveBeenCalled();
    });

    it("should change the running state of the camera when clicking camera icon", () => {
        spyOn(rosService, "subscribeCameraTopic");
        spyOn(rosService, "subscribeCameraCborTopic");
        spyOn(cameraService, "publishCameraSettings");
        const spyOnToggleCamera = spyOn(
            component,
            "toggleCameraState",
        ).and.callThrough();
        const toggleBtn = fixture.debugElement.query(By.css("#toggleCamera"));
        // Initially isActive is falsy (undefined from empty CameraSettings)
        toggleBtn.nativeElement.click();
        expect(spyOnToggleCamera).toHaveBeenCalledTimes(1);
        expect(component.cameraSettings?.isActive).toBeTrue();
        toggleBtn.nativeElement.click();
        expect(spyOnToggleCamera).toHaveBeenCalledTimes(2);
        expect(component.cameraSettings?.isActive).toBeFalse();
    });

    it("startCamera should subscribe to both the CBOR and the base64 camera topic", () => {
        const spySubscribeCbor = spyOn(rosService, "subscribeCameraCborTopic");
        const spySubscribe = spyOn(rosService, "subscribeCameraTopic");
        component.startCamera();
        expect(spySubscribeCbor).toHaveBeenCalled();
        expect(spySubscribe).toHaveBeenCalled();
    });

    it("should stay on the base64 image until a CBOR frame arrives", () => {
        spyOn(rosService, "subscribeCameraTopic");
        spyOn(rosService, "subscribeCameraCborTopic");
        component.startCamera();
        expect(component.cborActive).toBeFalse();

        rosService.cameraCborReceiver$.next(
            new Uint8Array([0xff, 0xd8, 0xff, 0xe0]),
        );
        expect(component.cborActive).toBeTrue();
    });

    it("stopCamera should get called when OnDestroy is called", () => {
        component.ngOnDestroy();
        expect(spyUnsubscribeCamera).toHaveBeenCalled();
        expect(spyUnsubscribeCameraCbor).toHaveBeenCalled();
    });

    /** Two registry entries, in the order the camera node publishes them. */
    const MODELS = {
        yolov6n: {
            type: "detection",
            description: "YOLOv6 Nano",
            classes: 80,
            slug: "luxonis/yolov6-nano:r2-coco-512x288",
        },
        face: {
            type: "detection",
            description: "YuNet face detection",
            classes: 1,
            slug: "luxonis/yunet:640x480",
        },
    };

    const modelMenuEntries = () =>
        fixture.debugElement.queryAll(
            By.css('[aria-labelledby="aiModelDropdown"] button'),
        );

    it("lists the available models in the menu, in the backend's order", () => {
        component.aiEnabled = true;
        rosService.aiAvailableModelsReceiver$.next(MODELS);
        fixture.detectChanges();

        const texts = modelMenuEntries().map((el) =>
            el.nativeElement.textContent.replace(/\s+/g, " ").trim(),
        );
        expect(texts).toEqual(["yolov6n (detection)", "face (detection)"]);
    });

    it("shows a disabled placeholder until the camera node reports its models", () => {
        component.aiEnabled = true;
        fixture.detectChanges();

        const entries = modelMenuEntries();
        expect(entries.length).toBe(1);
        expect(entries[0].nativeElement.disabled).toBeTrue();
        expect(entries[0].nativeElement.textContent).toContain(
            "Waiting for the camera node",
        );
    });

    it("labels the model button from the current_model `name` field", () => {
        component.aiEnabled = true;
        rosService.aiCurrentModelReceiver$.next({
            name: "yolov6n",
            type: "detection",
            description: "YOLOv6 Nano",
            classes: 80,
            slug: "luxonis/yolov6-nano:r2-coco-512x288",
            active: true,
            loading: false,
            error: null,
        });
        fixture.detectChanges();

        const label = fixture.debugElement.query(
            By.css("#aiModelDropdown span"),
        );
        expect(label.nativeElement.textContent.trim()).toBe("yolov6n");
    });

    it("names boxes from single-class models after the model, not the COCO table", () => {
        rosService.aiAvailableModelsReceiver$.next(MODELS);
        const fillText = spyOn(CanvasRenderingContext2D.prototype, "fillText");
        const frame = (model: string) => ({
            model,
            type: "detection",
            frame_id: 1,
            timestamp_ns: 0,
            latency_ms: 10,
            result: {
                detections: [
                    {
                        label: 0,
                        confidence: 0.87,
                        bbox: {xmin: 0.1, ymin: 0.2, xmax: 0.4, ymax: 0.8},
                    },
                ],
                count: 1,
            },
        });

        component["drawAiOverlay"](frame("face"));
        component["drawAiOverlay"](frame("yolov6n"));

        expect(fillText.calls.allArgs().map((args) => args[0])).toEqual([
            "face 87%",
            "person 87%",
        ]);
    });

    it("counts keypoint and prediction results, not only bounding boxes", () => {
        component.latestDetection = {
            model: "pose_hrnet",
            type: "pose",
            frame_id: 1,
            timestamp_ns: 0,
            latency_ms: 10,
            result: {
                keypoints: [
                    {x: 0.1, y: 0.1, confidence: 0.9},
                    {x: 0.2, y: 0.2, confidence: 0.8},
                ],
                count: 2,
            },
        };
        expect(component.getDetectionCount()).toBe(2);

        component.latestDetection = {
            model: "gaze",
            type: "gaze",
            frame_id: 2,
            timestamp_ns: 0,
            latency_ms: 10,
            result: {predictions: [{class: 0, confidence: 0.6}], count: 1},
        };
        expect(component.getDetectionCount()).toBe(1);
        expect(component.getDetectionError()).toBeNull();
    });

    it("surfaces a formatter error instead of counting it as a detection", () => {
        component.latestDetection = {
            model: "hand",
            type: "hand",
            frame_id: 1,
            timestamp_ns: 0,
            latency_ms: 10,
            result: {error: "depthai-nodes not installed"},
        };

        expect(component.getDetectionCount()).toBe(0);
        expect(component.getDetectionError()).toBe(
            "depthai-nodes not installed",
        );
    });

    it("offers exactly the report rates DepthAI exposes for the BMI270", () => {
        expect(component.imuFrequencies).toEqual([25, 50, 100, 200, 250]);
    });
});

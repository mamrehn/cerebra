import {BehaviorSubject, Observable, Subject} from "rxjs";
import {GoalHandle} from "../../ros-types/action/goal-handle";
import {
    RunProgramFeedback,
    RunProgramResult,
} from "../../ros-types/action/run-program";
import {JointTrajectoryMessage} from "../../ros-types/msg/joint-trajectory-message";
import {MotorSettingsMessage} from "../../ros-types/msg/motor-settings-message";
import {VoiceAssistantState} from "../../ros-types/msg/voice-assistant-state";
import {DiagnosticStatus} from "../../ros-types/msg/diagnostic-status.message";
import {ProxyRunProgramResult} from "../../ros-types/msg/proxy-run-program-result";
import {ProxyRunProgramFeedback} from "../../ros-types/msg/proxy-run-program-feedback";
import {ProxyRunProgramStatus} from "../../ros-types/msg/proxy-run-program-status";
import {ChatMessage} from "../../ros-types/msg/chat-message";
import {ChatIsListening} from "../../ros-types/msg/chat-is-listening";
import {SolidStateRelayState} from "../../ros-types/msg/solid-state-relay-state";
import {
    AiAvailableModelsMessage,
    AiConfig,
    AiCurrentModelMessage,
    AiDetectionMessage,
    JpegBytes,
} from "../../interfaces/ai-detection.interface";
import {
    ImuConfig,
    ImuData,
    Vector3Stamped,
} from "../../interfaces/imu-data.interface";
import {CameraVideoConfig} from "../../types/camera-settings";

export interface IRosService {
    currentReceiver$: Subject<DiagnosticStatus>;
    cameraTimerPeriodReceiver$: BehaviorSubject<number>;
    cameraReceiver$: Subject<string>;
    cameraCborReceiver$: Subject<JpegBytes>;
    aiDetectionsReceiver$: Subject<AiDetectionMessage>;
    aiAvailableModelsReceiver$: BehaviorSubject<AiAvailableModelsMessage | null>;
    aiCurrentModelReceiver$: BehaviorSubject<AiCurrentModelMessage | null>;
    imuDataReceiver$: Subject<ImuData>;
    imuAccelerometerReceiver$: Subject<Vector3Stamped>;
    imuGyroscopeReceiver$: Subject<Vector3Stamped>;
    cameraPreviewSizeReceiver$: BehaviorSubject<number[]>;
    cameraQualityFactorReceiver$: BehaviorSubject<number>;
    jointTrajectoryReceiver$: Subject<JointTrajectoryMessage>;
    motorSettingsReceiver$: Subject<MotorSettingsMessage>;
    proxyRunProgramFeedbackReceiver$: Subject<ProxyRunProgramFeedback>;
    proxyRunProgramResultReceiver$: Subject<ProxyRunProgramResult>;
    proxyRunProgramStatusReceiver$: Subject<ProxyRunProgramStatus>;
    voiceAssistantStateReceiver$: BehaviorSubject<VoiceAssistantState>;
    chatMessageReceiver$: Subject<ChatMessage>;
    chatIsListeningReceiver$: Subject<ChatIsListening>;
    solidStateRelayStateReceiver$: BehaviorSubject<
        SolidStateRelayState | undefined
    >;
    connectionStatus$: Observable<boolean>;

    setVoiceAssistantState: (
        voiceAssistantState: VoiceAssistantState,
    ) => Observable<void>;

    getChatIsListening(chatId: string): Observable<boolean>;

    sendChatMessage(chatId: string, content: string): Observable<void>;

    applyMotorSettings: (
        motorSettingsMessage: MotorSettingsMessage,
    ) => Observable<MotorSettingsMessage>;

    runProgram: (
        programNumber: string,
    ) => Observable<GoalHandle<RunProgramFeedback, RunProgramResult>>;

    applyJointTrajectory: (jointTrajectory: JointTrajectoryMessage) => void;

    setTimerPeriod: (period: number) => void;

    setPreviewSize: (width: number, height: number) => void;

    setQualityFactor: (factor: number) => void;

    subscribeCameraTopic: () => void;

    unsubscribeCameraTopic: () => void;

    subscribeCameraCborTopic: () => void;

    unsubscribeCameraCborTopic: () => void;

    publishCameraConfig: (config: CameraVideoConfig) => void;

    subscribeAiDetectionsTopic: () => void;

    unsubscribeAiDetectionsTopic: () => void;

    publishAiConfig: (config: AiConfig) => void;

    subscribeImuDataTopic: () => void;

    unsubscribeImuDataTopic: () => void;

    subscribeImuAccelerometerTopic: () => void;

    unsubscribeImuAccelerometerTopic: () => void;

    subscribeImuGyroscopeTopic: () => void;

    unsubscribeImuGyroscopeTopic: () => void;

    publishImuConfig: (config: ImuConfig) => void;

    publishProgramInput: (input: string, mpid: number) => void;

    setSolidStateRelayState(state: SolidStateRelayState): Observable<void>;
}

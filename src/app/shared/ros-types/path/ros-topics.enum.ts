export enum rosTopics {
    jointTrajectoryTopicName = "/joint_trajectory",
    motorCurrentTopicName = "/motor_current",
    cameraPreviewSizeTopicName = "/camera/preview_size",
    cameraTimerPeriodTopicName = "/camera/timer_period",
    cameraTopicName = "/camera_topic",
    cameraQualityTopic = "/camera/quality_factor",
    chatMessages = "/chat_messages",
    voiceAssistantState = "/voice_assistant_state",
    chatIsListening = "/chat_is_listening",
    motorSettingsTopicName = "/motor_settings",
    proxyRunProgramFeedback = "/proxy_run_program_feedback",
    proxyRunProgramResult = "/proxy_run_program_result",
    proxyRunProgramStatus = "/proxy_run_program_status",
    programInput = "/program_input",
    deleteTokenTopic = "/delete_token",
    solidStateRelayState = "/solid_state_relay_state",

    // Camera CBOR (binary JPEG, faster than base64)
    cameraImageCbor = "/camera/image/compressed",
    cameraConfig = "/camera/video/config",

    // AI Vision (OAK-D Lite on-demand inference)
    aiDetections = "/camera/ai/detections",
    aiConfig = "/camera/ai/config",
    aiAvailableModels = "/camera/ai/available_models",
    aiCurrentModel = "/camera/ai/current_model",

    // IMU (OAK-D Lite BMI270 6-axis)
    imuData = "/camera/imu",
    imuAccelerometer = "/camera/imu/accelerometer",
    imuGyroscope = "/camera/imu/gyroscope",
    imuConfig = "/camera/imu/config",
}

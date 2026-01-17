export enum rosTopics {
    jointTrajectoryTopicName = "/joint_trajectory",
    motorCurrentTopicName = "/motor_current",
    cameraPreviewSizeTopicName = "/size_topic",
    cameraTimerPeriodTopicName = "/timer_period_topic",
    cameraTopicName = "/camera_topic",
    cameraQualityTopic = "/quality_factor_topic",
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
    cameraImageCbor = "/camera/image",
    cameraConfig = "/camera/config",

    // AI Vision (OAK-D Lite on-demand inference)
    aiDetections = "/ai/detections",
    aiConfig = "/ai/config",
    aiAvailableModels = "/ai/available_models",
    aiCurrentModel = "/ai/current_model",

    // IMU (OAK-D Lite BMI270 6-axis)
    imuData = "/imu/data",
    imuAccelerometer = "/imu/accelerometer",
    imuGyroscope = "/imu/gyroscope",
    imuConfig = "/imu/config",
}

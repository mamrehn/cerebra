export enum rosDataTypes {
    // std msgs
    empty = "std_msgs/msg/Empty",
    int32 = "std_msgs/msg/Int32",
    int32MultiArray = "std_msgs/msg/Int32MultiArray",
    float64 = "std_msgs/msg/Float64",
    string = "std_msgs/msg/String",

    // sensor msgs
    compressedImage = "sensor_msgs/msg/CompressedImage",
    imu = "sensor_msgs/msg/Imu",

    // geometry msgs
    vector3Stamped = "geometry_msgs/msg/Vector3Stamped",

    // msg
    motorSettings = "datatypes/msg/MotorSettings",
    chatMessage = "datatypes/msg/ChatMessage",
    voiceAssistantState = "datatypes/msg/VoiceAssistantState",
    chatIsListening = "datatypes/msg/ChatIsListening",
    jointTrajectory = "trajectory_msgs/msg/JointTrajectory",
    diagnosticStatus = "diagnostic_msgs/msg/DiagnosticStatus",
    proxyRunProgramFeedback = "datatypes/msg/ProxyRunProgramFeedback",
    proxyRunProgramResult = "datatypes/msg/ProxyRunProgramResult",
    proxyRunProgramStatus = "datatypes/msg/ProxyRunProgramStatus",
    programInput = "datatypes/msg/ProgramInput",
    solidStateRelayState = "datatypes/msg/SolidStateRelayState",
    // srv
    applyMotorSettings = "datatypes/srv/ApplyMotorSettings",
    proxyRunProgramStart = "datatypes/srv/ProxyStartProgram",
    proxyRunProgramStop = "datatypes/srv/ProxyStopProgram",
    setVoiceAssistantState = "datatypes/srv/SetVoiceAssistantState",
    sendChatMessage = "datatypes/srv/SendChatMessage",
    getVoiceAssistantState = "datatypes/srv/GetVoiceAssistantState",
    getChatIsListening = "datatypes/srv/GetChatIsListening",
    applyJointTrajectory = "datatypes/srv/ApplyJointTrajectory",
    get_token_exists = "datatypes/srv/GetTokenExists",
    encryptToken = "datatypes/srv/EncryptToken",
    decryptToken = "datatypes/srv/DecryptToken",
    setSolidStateRelayState = "datatypes/srv/SetSolidStateRelayState",
    // action
    runProgram = "datatypes/action/RunProgram",
}

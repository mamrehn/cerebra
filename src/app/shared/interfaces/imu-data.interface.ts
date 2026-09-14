/**
 * IMU data interfaces for OAK-D Lite BMI270 6-axis sensor
 * Based on ROS_TOPICS.md and PLAN_AI_IMAGE_WEBSOCKET.md
 */

/** ROS2 Header message */
export interface RosHeader {
    stamp: {
        sec: number;
        nanosec: number;
    };
    frame_id: string;
}

/** 3D Vector */
export interface Vector3 {
    x: number;
    y: number;
    z: number;
}

/** Quaternion orientation */
export interface Quaternion {
    x: number;
    y: number;
    z: number;
    w: number;
}

/**
 * Full IMU message (sensor_msgs/Imu)
 * Contains accelerometer and gyroscope data
 */
export interface ImuData {
    header: RosHeader;
    orientation: Quaternion;
    orientation_covariance: number[]; // 9 elements (3x3 matrix, row-major)
    angular_velocity: Vector3;
    angular_velocity_covariance: number[]; // 9 elements
    linear_acceleration: Vector3;
    linear_acceleration_covariance: number[]; // 9 elements
}

/**
 * Vector3Stamped message (geometry_msgs/Vector3Stamped)
 * Used for accelerometer-only or gyroscope-only streams
 */
export interface Vector3Stamped {
    header: RosHeader;
    vector: Vector3;
}

/**
 * Report rates DepthAI exposes for the BMI270, in Hz (docs.luxonis.com, BMI270:
 * "DepthAI-exposed runtime behavior"). Requests round down, and anything above
 * 400 Hz tops out around 250 Hz.
 *
 * The camera node's BMI270_VALID_FREQUENCIES lists 400 where it should list 250
 * and snaps each request to its nearest entry, so until that is corrected a
 * 250 Hz request is delivered at 200 Hz.
 */
export type ImuFrequency = 25 | 50 | 100 | 200 | 250;

/**
 * IMU configuration for publishing to the IMU config topic.
 * Note: the backend snaps the request to the nearest supported frequency and
 * logs a warning, so an unsupported value fails silently from the UI's side.
 */
export interface ImuConfig {
    frequency: ImuFrequency;
}

/** Valid IMU frequencies for the BMI270 sensor */
export const VALID_IMU_FREQUENCIES: readonly ImuFrequency[] = [
    25, 50, 100, 200, 250,
] as const;

/**
 * Compute magnitude of a 3D vector
 */
export function vectorMagnitude(v: Vector3): number {
    return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

/**
 * Convert IMU timestamp to milliseconds
 */
export function imuTimestampToMs(stamp: {
    sec: number;
    nanosec: number;
}): number {
    return stamp.sec * 1000 + stamp.nanosec / 1_000_000;
}

/**
 * Calculate roll and pitch from accelerometer data (in radians)
 * Note: Yaw cannot be determined from accelerometer alone
 */
export function accelerometerToRollPitch(accel: Vector3): {
    roll: number;
    pitch: number;
} {
    const roll = Math.atan2(accel.y, accel.z);
    const pitch = Math.atan2(
        -accel.x,
        Math.sqrt(accel.y * accel.y + accel.z * accel.z),
    );
    return {roll, pitch};
}

/**
 * Convert quaternion to Euler angles (roll, pitch, yaw) in radians
 */
export function quaternionToEuler(q: Quaternion): {
    roll: number;
    pitch: number;
    yaw: number;
} {
    // Roll (x-axis rotation)
    const sinr_cosp = 2 * (q.w * q.x + q.y * q.z);
    const cosr_cosp = 1 - 2 * (q.x * q.x + q.y * q.y);
    const roll = Math.atan2(sinr_cosp, cosr_cosp);

    // Pitch (y-axis rotation)
    const sinp = 2 * (q.w * q.y - q.z * q.x);
    let pitch: number;
    if (Math.abs(sinp) >= 1) {
        pitch = (Math.sign(sinp) * Math.PI) / 2; // Use 90 degrees if out of range
    } else {
        pitch = Math.asin(sinp);
    }

    // Yaw (z-axis rotation)
    const siny_cosp = 2 * (q.w * q.z + q.x * q.y);
    const cosy_cosp = 1 - 2 * (q.y * q.y + q.z * q.z);
    const yaw = Math.atan2(siny_cosp, cosy_cosp);

    return {roll, pitch, yaw};
}

/**
 * Convert radians to degrees
 */
export function radToDeg(rad: number): number {
    return rad * (180 / Math.PI);
}

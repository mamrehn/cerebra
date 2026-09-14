export class CameraSettings {
    resolution: string;
    refreshRate: number;
    qualityFactor: number;
    isActive?: boolean;
    resX: number;
    resY: number;

    constructor(
        resolution: string,
        refreshRate: number,
        qualityFactor: number,
        resX: number,
        resY: number,
        isActive?: boolean,
    ) {
        this.resolution = resolution;
        this.refreshRate = refreshRate;
        this.qualityFactor = qualityFactor;
        this.isActive = isActive ?? false;
        this.resX = resX;
        this.resY = resY;
    }
}

/**
 * The persisted shape of the camera settings resource.
 *
 * `isActive` is view state only: the backend's camera-settings schema does not
 * declare it, and marshmallow is configured to reject unknown fields, so
 * sending it makes the PUT fail with 400.
 */
export interface CameraSettingsDto {
    resolution: string;
    refreshRate: number;
    qualityFactor: number;
    resX: number;
    resY: number;
}

/** Drop client-only fields so the payload matches what the API accepts. */
export function toCameraSettingsDto(
    settings: CameraSettings,
): CameraSettingsDto {
    return {
        resolution: settings.resolution,
        refreshRate: settings.refreshRate,
        qualityFactor: settings.qualityFactor,
        resX: settings.resX,
        resY: settings.resY,
    };
}

/**
 * Payload for the `camera/video/config` topic.
 *
 * The camera node's `camera_config_callback` reads only these two keys; the
 * frame interval is controlled separately via `camera/timer_period`.
 */
export interface CameraVideoConfig {
    quality?: number;
    resolution?: [number, number];
}

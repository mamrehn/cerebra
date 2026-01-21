export class CameraSettings {
    constructor(resolution, refreshRate, qualityFactor, resX, resY) {
        this.resolution = resolution;
        this.refreshRate = refreshRate;
        this.qualityFactor = qualityFactor;
        this.resX = resX;
        this.resY = resY;
    }

    static getCameraSettings(cammeraSettings) {
        return new CameraSettings(
            cammeraSettings.resolution,
            cammeraSettings.refreshRate,
            cammeraSettings.qualityFactor,
            cammeraSettings.resX,
            cammeraSettings.resY,
        );
    }
}
export default CameraSettings;

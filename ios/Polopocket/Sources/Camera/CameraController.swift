import AVFoundation
import UIKit
import Combine

/// Thin AVFoundation wrapper: session lifecycle, front/back flip, flash-on-
/// capture, tap-to-focus (auto-revert to continuous, like the web app's
/// applyManualFocus/applyContinuousFocus pair), and crop-aware capture that
/// matches whatever rect the on-screen crop guide is showing.
final class CameraController: NSObject, ObservableObject {
    let session = AVCaptureSession()
    let previewLayer: AVCaptureVideoPreviewLayer

    @Published var isAuthorized = false
    @Published var isRunning = false
    @Published var facingBack = true

    private let sessionQueue = DispatchQueue(label: "polopocket.camera.session")
    private var currentInput: AVCaptureDeviceInput?
    private let photoOutput = AVCapturePhotoOutput()
    private var focusRevertWorkItem: DispatchWorkItem?
    private var activeCaptureProcessor: PhotoCaptureProcessor?

    override init() {
        previewLayer = AVCaptureVideoPreviewLayer(session: session)
        previewLayer.videoGravity = .resizeAspectFill
        super.init()
    }

    func requestAccessAndStart() {
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            isAuthorized = true
            configureAndStart()
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { [weak self] granted in
                DispatchQueue.main.async {
                    self?.isAuthorized = granted
                    if granted { self?.configureAndStart() }
                }
            }
        default:
            isAuthorized = false
        }
    }

    private func configureAndStart() {
        sessionQueue.async { [weak self] in
            guard let self else { return }
            self.session.beginConfiguration()
            self.session.sessionPreset = .photo
            self.attachInput(back: true)
            if self.session.canAddOutput(self.photoOutput) {
                self.session.addOutput(self.photoOutput)
            }
            self.session.commitConfiguration()
            self.session.startRunning()
            DispatchQueue.main.async { self.isRunning = true }
        }
    }

    private func attachInput(back: Bool) {
        if let currentInput { session.removeInput(currentInput) }
        let position: AVCaptureDevice.Position = back ? .back : .front
        guard let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: position),
              let input = try? AVCaptureDeviceInput(device: device),
              session.canAddInput(input) else { return }
        session.addInput(input)
        currentInput = input
        try? device.lockForConfiguration()
        if device.isFocusModeSupported(.continuousAutoFocus) { device.focusMode = .continuousAutoFocus }
        device.unlockForConfiguration()
    }

    func switchCamera() {
        sessionQueue.async { [weak self] in
            guard let self else { return }
            self.session.beginConfiguration()
            self.attachInput(back: !self.facingBack)
            self.session.commitConfiguration()
            DispatchQueue.main.async { self.facingBack.toggle() }
        }
    }

    // MARK: - Focus

    /// isTap: a real tap locks focus at that point briefly; otherwise this is
    /// just the camera "waking up" (continuous autofocus at center).
    func focus(atLayerPoint layerPoint: CGPoint, isTap: Bool) {
        guard let device = currentInput?.device else { return }
        let devicePoint = previewLayer.captureDevicePointConverted(fromLayerPoint: layerPoint)
        sessionQueue.async {
            try? device.lockForConfiguration()
            if isTap, device.isFocusPointOfInterestSupported, device.isFocusModeSupported(.autoFocus) {
                device.focusPointOfInterest = devicePoint
                device.focusMode = .autoFocus
                if device.isExposurePointOfInterestSupported, device.isExposureModeSupported(.autoExpose) {
                    device.exposurePointOfInterest = devicePoint
                    device.exposureMode = .autoExpose
                }
            }
            device.unlockForConfiguration()
        }
        if isTap {
            focusRevertWorkItem?.cancel()
            let revert = DispatchWorkItem { [weak self] in self?.revertToContinuousFocus() }
            focusRevertWorkItem = revert
            sessionQueue.asyncAfter(deadline: .now() + 4, execute: revert)
        }
    }

    private func revertToContinuousFocus() {
        guard let device = currentInput?.device else { return }
        try? device.lockForConfiguration()
        if device.isFocusModeSupported(.continuousAutoFocus) { device.focusMode = .continuousAutoFocus }
        if device.isExposureModeSupported(.continuousAutoExposure) { device.exposureMode = .continuousAutoExposure }
        device.unlockForConfiguration()
    }

    // MARK: - Capture

    /// `cropRectInLayer` is the on-screen crop-guide rect, in the preview
    /// layer's own coordinate space — converted to normalized device
    /// coordinates via the preview layer so the capture matches exactly
    /// what the guide boxed in, framing included.
    func capturePhoto(cropRectInLayer: CGRect, flashOn: Bool, completion: @escaping (UIImage?) -> Void) {
        let settings = AVCapturePhotoSettings()
        if let device = currentInput?.device, device.isFlashAvailable, device.isFlashModeSupported(flashOn ? .on : .off) {
            settings.flashMode = flashOn ? .on : .off
        }
        let normalizedCrop = previewLayer.metadataOutputRectConverted(fromLayerRect: cropRectInLayer)
        let mirrored = !facingBack

        sessionQueue.async { [weak self] in
            guard let self else { return }
            if let connection = self.photoOutput.connection(with: .video) {
                if connection.isVideoOrientationSupported { connection.videoOrientation = .portrait }
                if connection.isVideoMirroringSupported { connection.isVideoMirrored = mirrored }
            }
            let processor = PhotoCaptureProcessor(normalizedCrop: normalizedCrop) { image in
                DispatchQueue.main.async { completion(image) }
                self.activeCaptureProcessor = nil
            }
            self.activeCaptureProcessor = processor
            self.photoOutput.capturePhoto(with: settings, delegate: processor)
        }
    }
}

/// One-shot AVCapturePhotoCaptureDelegate that crops the result to the
/// normalized rect the crop guide was showing before handing back a UIImage.
private final class PhotoCaptureProcessor: NSObject, AVCapturePhotoCaptureDelegate {
    private let normalizedCrop: CGRect
    private let completion: (UIImage?) -> Void

    init(normalizedCrop: CGRect, completion: @escaping (UIImage?) -> Void) {
        self.normalizedCrop = normalizedCrop
        self.completion = completion
    }

    func photoOutput(_ output: AVCapturePhotoOutput, didFinishProcessingPhoto photo: AVCapturePhoto, error: Error?) {
        guard error == nil,
              let data = photo.fileDataRepresentation(),
              let image = UIImage(data: data),
              let cgImage = image.cgImage else {
            completion(nil)
            return
        }

        let pixelW = CGFloat(cgImage.width), pixelH = CGFloat(cgImage.height)
        let cropRect = CGRect(
            x: normalizedCrop.origin.x * pixelW,
            y: normalizedCrop.origin.y * pixelH,
            width: normalizedCrop.width * pixelW,
            height: normalizedCrop.height * pixelH
        ).intersection(CGRect(x: 0, y: 0, width: pixelW, height: pixelH))

        guard !cropRect.isEmpty, let cropped = cgImage.cropping(to: cropRect) else {
            completion(image)
            return
        }
        completion(UIImage(cgImage: cropped, scale: image.scale, orientation: image.imageOrientation))
    }
}

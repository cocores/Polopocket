import SwiftUI
import AVFoundation

/// Hosts the AVCaptureVideoPreviewLayer inside SwiftUI, keeping the layer's
/// frame synced to the view's bounds (including rotation/resize).
struct CameraPreviewView: UIViewRepresentable {
    let controller: CameraController

    func makeUIView(context: Context) -> PreviewUIView {
        let view = PreviewUIView()
        view.previewLayer = controller.previewLayer
        view.layer.addSublayer(controller.previewLayer)
        return view
    }

    func updateUIView(_ uiView: PreviewUIView, context: Context) {}

    final class PreviewUIView: UIView {
        var previewLayer: AVCaptureVideoPreviewLayer?

        override func layoutSubviews() {
            super.layoutSubviews()
            previewLayer?.frame = bounds
        }
    }
}

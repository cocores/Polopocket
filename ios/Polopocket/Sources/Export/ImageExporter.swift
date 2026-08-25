import UIKit
import Photos

enum ImageExporter {
    enum ExportError: Error { case renderFailed, notAuthorized }

    /// Renders the full framed print — border + photo (style filter + overlay
    /// baked in) + handwritten caption — exactly what renderPolaroidCard()
    /// produces in the web app, then saves it to the user's Photos library.
    static func savePolaroidCard(for photo: Photo) async throws {
        guard let card = renderCard(for: photo) else { throw ExportError.renderFailed }

        let status = await PHPhotoLibrary.requestAuthorization(for: .addOnly)
        guard status == .authorized || status == .limited else { throw ExportError.notAuthorized }

        try await PHPhotoLibrary.shared().performChanges {
            PHAssetChangeRequest.creationRequestForAsset(from: card)
        }
    }

    static func renderCard(for photo: Photo) -> UIImage? {
        let outW: CGFloat = 1080
        let sidePad = (outW * 0.045).rounded()
        let topPad = sidePad
        let bottomPad = (outW * 0.17).rounded()
        let photoW = outW - sidePad * 2
        let photoH = (photoW / CGFloat(photo.film.aspect)).rounded()
        let cardH = topPad + photoH + bottomPad

        let renderer = UIGraphicsImageRenderer(size: CGSize(width: outW, height: cardH))
        return renderer.image { rendererCtx in
            let ctx = rendererCtx.cgContext
            let bounds = CGRect(x: 0, y: 0, width: outW, height: cardH)

            UIColor(photo.frame.background).setFill()
            UIBezierPath(roundedRect: bounds, cornerRadius: 7).fill()

            let photoRect = CGRect(x: sidePad, y: topPad, width: photoW, height: photoH)
            let styled = ImageFilterRenderer.render(photo.filmGradedImage, applying: photo.style.filter)
            ctx.saveGState()
            ctx.clip(to: photoRect)
            styled.draw(in: photoRect)
            ctx.restoreGState()

            photo.style.overlay?.draw(in: ctx, rect: photoRect)

            drawCaption(photo, in: ctx,
                        center: CGPoint(x: outW / 2, y: topPad + photoH + bottomPad * 0.55),
                        maxWidth: outW - sidePad * 2)
        }
    }

    /// Draws the caption like it was written in marker on the print's
    /// border — same hand-tilt as the live view, shrunk to fit.
    private static func drawCaption(_ photo: Photo, in ctx: CGContext, center: CGPoint, maxWidth: CGFloat) {
        let text = photo.caption
        guard !text.isEmpty else { return }

        ctx.saveGState()
        ctx.translateBy(x: center.x, y: center.y)
        ctx.rotate(by: photo.captionTilt * .pi / 180)

        var fontSize = (maxWidth * 0.055).rounded()
        var font = UIFont(name: "MarkerFelt-Wide", size: fontSize) ?? .systemFont(ofSize: fontSize)
        let paragraph = NSMutableParagraphStyle()
        paragraph.alignment = .center

        func attributes(_ font: UIFont) -> [NSAttributedString.Key: Any] {
            [.font: font, .foregroundColor: UIColor(photo.frame.ink), .paragraphStyle: paragraph]
        }

        var size = (text as NSString).size(withAttributes: attributes(font))
        while size.width > maxWidth, fontSize > 10 {
            fontSize -= 1
            font = UIFont(name: "MarkerFelt-Wide", size: fontSize) ?? .systemFont(ofSize: fontSize)
            size = (text as NSString).size(withAttributes: attributes(font))
        }

        let drawRect = CGRect(x: -size.width / 2, y: -size.height / 2, width: size.width, height: size.height)
        (text as NSString).draw(in: drawRect, withAttributes: attributes(font))
        ctx.restoreGState()
    }
}

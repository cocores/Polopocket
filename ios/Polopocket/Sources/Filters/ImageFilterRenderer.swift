import UIKit
import CoreImage

/// Shared CIContext (expensive to create) used everywhere a FilterParams
/// grade needs to be baked into an actual UIImage — live preview caching
/// and final export both go through this.
enum ImageFilterRenderer {
    static let context = CIContext()

    static func render(_ image: UIImage, applying params: FilterParams) -> UIImage {
        guard let cgImage = image.cgImage else { return image }
        let input = CIImage(cgImage: cgImage)
        let output = params.apply(to: input)
        guard let rendered = context.createCGImage(output, from: input.extent) else { return image }
        return UIImage(cgImage: rendered, scale: image.scale, orientation: image.imageOrientation)
    }
}

import CoreImage
import CoreImage.CIFilterBuiltins

/// Renders a FilterParams grade the same way the web app's CSS filter
/// chain does — brightness → contrast → saturate → sepia → grayscale →
/// hue-rotate — using the closest stock Core Image equivalents at each step.
extension FilterParams {
    func apply(to image: CIImage) -> CIImage {
        var output = image

        let colorControls = CIFilter.colorControls()
        colorControls.inputImage = output
        // CIColorControls brightness is additive (-1...1), CSS brightness() is
        // multiplicative around 1 — approximate by scaling around the same pivot.
        colorControls.brightness = Float(brightness - 1)
        colorControls.contrast = Float(contrast)
        colorControls.saturation = Float(saturation)
        output = colorControls.outputImage ?? output

        if sepia > 0 {
            let sepiaFilter = CIFilter.sepiaTone()
            sepiaFilter.inputImage = output
            sepiaFilter.intensity = Float(sepia)
            output = sepiaFilter.outputImage ?? output
        }

        if grayscale > 0 {
            // CSS grayscale(amount) linearly interpolates toward a fully
            // desaturated image — a straight saturation cut is the same effect.
            let desat = CIFilter.colorControls()
            desat.inputImage = output
            desat.saturation = Float(1 - grayscale)
            output = desat.outputImage ?? output
        }

        if hueRotate != 0 {
            let hue = CIFilter.hueAdjust()
            hue.inputImage = output
            hue.angle = Float(hueRotate * .pi / 180)
            output = hue.outputImage ?? output
        }

        return output
    }
}

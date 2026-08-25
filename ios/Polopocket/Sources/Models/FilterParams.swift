import Foundation

/// A flat set of grade/finish knobs — mirrors the CSS filter model in the
/// web app (brightness/contrast/saturate/sepia/grayscale/hueRotate) so a
/// film stock's baked-in grade and a photo style's finishing filter are the
/// same shape and can be composed the same way.
struct FilterParams: Equatable {
    var brightness: Double = 1
    var contrast: Double = 1
    var saturation: Double = 1
    var sepia: Double = 0
    var grayscale: Double = 0
    /// degrees, matching the web version's hue-rotate(...deg)
    var hueRotate: Double = 0

    static let identity = FilterParams()
}

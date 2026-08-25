import SwiftUI

/// The bucket a style chip is filed under — drives the tab row in the
/// viewer so ten-plus styles don't have to live in one long wrapping row.
enum StyleGroup: String, CaseIterable, Identifiable {
    case classic = "Classic"
    case color = "Color"
    case lightFX = "Light FX"

    var id: String { rawValue }
}

/// A gradient bloom layered on top of a style's filter grade — light leaks,
/// a golden-hour wash, a soft haze. Position/color stops are fractional so
/// the same descriptor renders identically in the live SwiftUI preview and
/// in the baked CoreGraphics export.
struct ColorStop: Equatable {
    let offset: Double
    let color: Color
}

struct OverlayDescriptor: Equatable {
    enum Kind: Equatable { case radial, linear }

    let kind: Kind
    /// fractional center, radial only
    var center: CGPoint = CGPoint(x: 0.5, y: 0.5)
    /// fractional radius (relative to max(width, height)), radial only
    var radius: Double = 1
    /// degrees, linear only — 0 = left-to-right, matches CSS linear-gradient angle convention
    var angle: Double = 135
    var blendMode: BlendMode = .screen
    var opacity: Double = 1
    var stops: [ColorStop]
}

/// A finishing filter layered on top of the film's own baked-in grade,
/// chosen per-photo in the viewer, same as frame style. Bucketed by group
/// so the viewer can show one group of chips at a time.
struct PhotoStyle: Identifiable, Equatable {
    let id = UUID()
    let label: String
    let group: StyleGroup
    let filter: FilterParams
    let overlay: OverlayDescriptor?

    static func ==(lhs: PhotoStyle, rhs: PhotoStyle) -> Bool { lhs.id == rhs.id }

    static let all: [PhotoStyle] = [
        PhotoStyle(label: "Original", group: .classic, filter: .identity, overlay: nil),
        PhotoStyle(label: "Mono", group: .classic, filter: FilterParams(contrast: 1.1, grayscale: 1), overlay: nil),
        PhotoStyle(label: "Noir", group: .classic, filter: FilterParams(brightness: 0.85, contrast: 1.35, grayscale: 0.7), overlay: nil),
        PhotoStyle(label: "Sepia", group: .classic, filter: FilterParams(contrast: 1.05, saturation: 0.9, sepia: 0.75), overlay: nil),

        PhotoStyle(label: "Vivid", group: .color, filter: FilterParams(contrast: 1.15, saturation: 1.5), overlay: nil),
        PhotoStyle(label: "Faded", group: .color, filter: FilterParams(brightness: 1.12, contrast: 0.85, saturation: 0.5), overlay: nil),
        PhotoStyle(label: "Cross Process", group: .color, filter: FilterParams(brightness: 1.02, contrast: 1.2, saturation: 1.6, hueRotate: -12), overlay: nil),

        PhotoStyle(
            label: "Light Leak", group: .lightFX,
            filter: FilterParams(brightness: 1.05, contrast: 1.05, saturation: 1.1, sepia: 0.05),
            overlay: OverlayDescriptor(
                kind: .radial, center: CGPoint(x: 0.88, y: 0.1), radius: 0.95,
                blendMode: .screen, opacity: 0.9,
                stops: [
                    ColorStop(offset: 0, color: Color(hex: 0xffc46e, alpha: 0.95)),
                    ColorStop(offset: 0.35, color: Color(hex: 0xff6e2d, alpha: 0.55)),
                    ColorStop(offset: 1, color: Color(hex: 0xff6e2d, alpha: 0)),
                ]
            )
        ),
        PhotoStyle(
            label: "Golden Hour", group: .lightFX,
            filter: FilterParams(brightness: 1.08, contrast: 0.95, saturation: 1.1, sepia: 0.15),
            overlay: OverlayDescriptor(
                kind: .linear, angle: 130,
                blendMode: .softLight, opacity: 0.6,
                stops: [
                    ColorStop(offset: 0, color: Color(hex: 0xffd68c, alpha: 0.9)),
                    ColorStop(offset: 0.6, color: Color(hex: 0xff965a, alpha: 0.25)),
                    ColorStop(offset: 1, color: Color(hex: 0xff965a, alpha: 0)),
                ]
            )
        ),
        PhotoStyle(
            label: "Dreamy Haze", group: .lightFX,
            filter: FilterParams(brightness: 1.1, contrast: 0.85, saturation: 0.85),
            overlay: OverlayDescriptor(
                kind: .radial, center: CGPoint(x: 0.5, y: 0.42), radius: 0.75,
                blendMode: .softLight, opacity: 0.75,
                stops: [
                    ColorStop(offset: 0, color: Color(white: 1, opacity: 0.85)),
                    ColorStop(offset: 0.55, color: Color(white: 1, opacity: 0.25)),
                    ColorStop(offset: 1, color: Color(white: 1, opacity: 0)),
                ]
            )
        ),
    ]

    static func styles(in group: StyleGroup) -> [PhotoStyle] {
        all.filter { $0.group == group }
    }
}

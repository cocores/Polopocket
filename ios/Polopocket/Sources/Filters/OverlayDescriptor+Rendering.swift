import SwiftUI
import UIKit
import CoreGraphics

extension BlendMode {
    /// The handful of blend modes PhotoStyle overlays actually use.
    var cgBlendMode: CGBlendMode {
        switch self {
        case .screen: return .screen
        case .softLight: return .softLight
        default: return .normal
        }
    }
}

/// Live SwiftUI rendering of a style overlay — used in the camera-adjacent
/// polaroid views and the viewer preview. Mirrors overlayCssBackground()
/// in the web app.
struct StyleOverlayView: View {
    let overlay: OverlayDescriptor?

    var body: some View {
        GeometryReader { geo in
            if let overlay {
                let gradientStops = overlay.stops.map { Gradient.Stop(color: $0.color, location: CGFloat($0.offset)) }
                Group {
                    switch overlay.kind {
                    case .radial:
                        RadialGradient(
                            gradient: Gradient(stops: gradientStops),
                            center: UnitPoint(x: overlay.center.x, y: overlay.center.y),
                            startRadius: 0,
                            endRadius: CGFloat(overlay.radius) * max(geo.size.width, geo.size.height)
                        )
                    case .linear:
                        let radians = CGFloat(overlay.angle) * .pi / 180
                        LinearGradient(
                            gradient: Gradient(stops: gradientStops),
                            startPoint: UnitPoint(x: 0.5 - cos(radians) / 2, y: 0.5 - sin(radians) / 2),
                            endPoint: UnitPoint(x: 0.5 + cos(radians) / 2, y: 0.5 + sin(radians) / 2)
                        )
                    }
                }
                .blendMode(overlay.blendMode)
                .opacity(overlay.opacity)
            }
        }
        .allowsHitTesting(false)
    }
}

/// Baked (export-time) rendering of a style overlay into a CoreGraphics
/// context — mirrors drawOverlay() in the web app so the JPEG/PNG export
/// matches the on-screen preview pixel for pixel.
extension OverlayDescriptor {
    func draw(in ctx: CGContext, rect: CGRect) {
        ctx.saveGState()
        ctx.clip(to: rect)

        let colors = stops.map { UIColor($0.color).cgColor } as CFArray
        let locations = stops.map { CGFloat($0.offset) }
        guard let gradient = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: colors, locations: locations) else {
            ctx.restoreGState()
            return
        }

        ctx.setBlendMode(blendMode.cgBlendMode)
        ctx.setAlpha(CGFloat(opacity))

        switch kind {
        case .radial:
            let center = CGPoint(x: rect.minX + CGFloat(self.center.x) * rect.width,
                                  y: rect.minY + CGFloat(self.center.y) * rect.height)
            let endRadius = CGFloat(radius) * max(rect.width, rect.height)
            ctx.drawRadialGradient(gradient, startCenter: center, startRadius: 0,
                                    endCenter: center, endRadius: endRadius,
                                    options: [.drawsAfterEndLocation])
        case .linear:
            let radians = CGFloat(angle) * .pi / 180
            let dx = cos(radians), dy = sin(radians)
            let center = CGPoint(x: rect.midX, y: rect.midY)
            let half = (abs(dx) * rect.width + abs(dy) * rect.height) / 2
            let start = CGPoint(x: center.x - dx * half, y: center.y - dy * half)
            let end = CGPoint(x: center.x + dx * half, y: center.y + dy * half)
            ctx.drawLinearGradient(gradient, start: start, end: end, options: [.drawsAfterEndLocation])
        }

        ctx.restoreGState()
    }
}

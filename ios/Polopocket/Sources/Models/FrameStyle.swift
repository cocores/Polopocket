import SwiftUI

/// A border/caption color pairing, chosen per-photo in the viewer.
struct FrameStyle: Identifiable, Equatable {
    let id = UUID()
    let label: String
    let background: Color
    let ink: Color

    static let all: [FrameStyle] = [
        FrameStyle(label: "Classic White", background: Color(hex: 0xf2ead9), ink: Color(hex: 0x3a3226)),
        FrameStyle(label: "Vintage Yellowed", background: Color(hex: 0xe4cf98), ink: Color(hex: 0x4a3a1e)),
        FrameStyle(label: "Sage", background: Color(hex: 0xc9d4bd), ink: Color(hex: 0x33422f)),
        FrameStyle(label: "Dusty Rose", background: Color(hex: 0xe3c3c2), ink: Color(hex: 0x4a2c2b)),
        FrameStyle(label: "Sky", background: Color(hex: 0xc7d6e0), ink: Color(hex: 0x25333d)),
        FrameStyle(label: "Amber", background: Color(hex: 0xe8c893), ink: Color(hex: 0x4a3113)),
    ]
}

extension Color {
    init(hex: UInt32, alpha: Double = 1) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xff) / 255,
            green: Double((hex >> 8) & 0xff) / 255,
            blue: Double(hex & 0xff) / 255,
            opacity: alpha
        )
    }
}

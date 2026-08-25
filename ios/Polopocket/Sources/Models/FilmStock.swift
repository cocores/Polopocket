import Foundation
import CoreGraphics

/// A real Polaroid film format — its image-area aspect ratio shapes the
/// print itself, and `finalGrade` is the color science baked in once at
/// capture time (mirrors FILM_STOCKS in the web app).
struct FilmStock: Identifiable, Equatable {
    let id = UUID()
    let label: String
    /// width / height of the image area
    let aspect: CGFloat
    let note: String
    let finalGrade: FilterParams
    let isPremium: Bool

    static let all: [FilmStock] = [
        FilmStock(label: "i-Type", aspect: 789.0/768.0, note: "Now / Now+ / Lab · no battery",
                  finalGrade: FilterParams(brightness: 1, contrast: 1.03, saturation: 1.05, sepia: 0.04), isPremium: false),
        FilmStock(label: "600", aspect: 789.0/768.0, note: "vintage 600-series · battery in pack",
                  finalGrade: FilterParams(brightness: 1.05, contrast: 1.06, saturation: 1.15, sepia: 0.07), isPremium: false),
        FilmStock(label: "SX-70", aspect: 789.0/768.0, note: "folding SX-70 · low ISO, needs more light",
                  finalGrade: FilterParams(brightness: 0.9, contrast: 0.94, saturation: 0.82, sepia: 0.22), isPremium: false),
        FilmStock(label: "Go", aspect: 460.0/470.0, note: "ultra-compact mini square",
                  finalGrade: FilterParams(brightness: 1.06, contrast: 1.1, saturation: 1.2), isPremium: false),
        FilmStock(label: "8×10", aspect: 8.0/10.0, note: "large-format studio · varies by mask",
                  finalGrade: FilterParams(brightness: 0.97, contrast: 1.12, saturation: 1, sepia: 0.05, grayscale: 0.3), isPremium: false),
        FilmStock(label: "Spectra", aspect: 90.0/73.0, note: "wide frame · discontinued",
                  finalGrade: FilterParams(brightness: 1.08, contrast: 0.9, saturation: 0.7, sepia: 0.15), isPremium: true),
        FilmStock(label: "Type 500", aspect: 73.0/54.0, note: "Captiva / Joycam mini · discontinued",
                  finalGrade: FilterParams(brightness: 1.1, contrast: 0.95, saturation: 0.85, sepia: 0.18), isPremium: true),
        FilmStock(label: "Type 100", aspect: 5.0/4.0, note: "peel-apart pack film · discontinued",
                  finalGrade: FilterParams(brightness: 0.95, contrast: 1.05, saturation: 0.7, sepia: 0.5), isPremium: true),
        FilmStock(label: "i-Zone", aspect: 24.0/36.0, note: "sticker film · discontinued",
                  finalGrade: FilterParams(brightness: 1.05, contrast: 1.22, saturation: 1.35, hueRotate: -3), isPremium: true),
    ]
}

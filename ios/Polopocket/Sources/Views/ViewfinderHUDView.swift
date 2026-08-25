import SwiftUI
import Combine

/// The heads-up overlay on the live viewfinder: clock, a fake exposure
/// readout, the current-film pill (tap to open the picker), and a focus
/// reticle. Cosmetic flourish carried over from the web app's viewfinder HUD.
struct ViewfinderHUDView: View {
    let film: FilmStock
    let onTapFilmHUD: () -> Void
    let focusPoint: CGPoint?
    let focusIsTap: Bool

    @State private var now = Date()
    @State private var exposure = 0.0
    private let clockTimer = Timer.publish(every: 1, on: .main, in: .common).autoconnect()
    private let exposureTimer = Timer.publish(every: 1.4, on: .main, in: .common).autoconnect()

    private static let timeFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "HH:mm:ss"
        return f
    }()

    var body: some View {
        ZStack {
            VStack {
                HStack(alignment: .top) {
                    Text(Self.timeFormatter.string(from: now))
                        .hudText()
                    Spacer()
                    Button(action: onTapFilmHUD) {
                        VStack(alignment: .trailing, spacing: 1) {
                            Text(film.label + " ▾").font(.system(size: 11, weight: .semibold))
                            Text(film.note).font(.system(size: 8.5))
                        }
                        .multilineTextAlignment(.trailing)
                    }
                    .hudText()
                }
                Spacer()
                HStack {
                    Text("EXP \(exposure, specifier: "%.1f")").hudText()
                    Spacer()
                }
            }
            .padding(14)

            if let focusPoint {
                Circle()
                    .stroke(focusIsTap ? Color.amber : Color.white.opacity(0.7), lineWidth: 1.5)
                    .frame(width: 64, height: 64)
                    .position(focusPoint)
                    .allowsHitTesting(false)
            }
        }
        .onReceive(clockTimer) { now = $0 }
        .onReceive(exposureTimer) { _ in exposure = Double.random(in: -0.3...0.3) }
    }
}

private extension View {
    func hudText() -> some View {
        self.font(.system(size: 11, weight: .medium, design: .monospaced))
            .foregroundColor(.white.opacity(0.85))
            .shadow(color: .black.opacity(0.6), radius: 2)
    }
}

import Foundation
import Combine

/// App-wide state: the current film selection, the "Print Box" of filed
/// photos, and the local premium-films unlock flag (mirrors the
/// localStorage flag in the web app — this is a cosmetic unlock, not a
/// real store integration).
final class PhotoStore: ObservableObject {
    @Published var filmIndex: Int = 0
    @Published var prints: [Photo] = []
    @Published var premiumUnlocked: Bool {
        didSet { UserDefaults.standard.set(premiumUnlocked, forKey: Self.premiumKey) }
    }

    private static let premiumKey = "pp_premium_films"

    init() {
        premiumUnlocked = UserDefaults.standard.bool(forKey: Self.premiumKey)
    }

    var currentFilm: FilmStock { FilmStock.all[filmIndex] }

    func file(_ photo: Photo) {
        prints.append(photo)
    }

    func unlockPremium() {
        premiumUnlocked = true
    }
}

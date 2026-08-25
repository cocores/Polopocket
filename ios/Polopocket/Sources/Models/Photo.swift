import UIKit

/// One captured print. `filmGradedImage` is the raw capture with the film
/// stock's grade already baked in (equivalent to `finalUrl` in the web
/// app); `style` and `frame` are chosen afterwards in the viewer and are
/// only baked in together with the caption at export time.
final class Photo: Identifiable, ObservableObject {
    let id = UUID()
    let rawImage: UIImage
    let filmGradedImage: UIImage
    let film: FilmStock
    let dateTaken: Date
    let captionTilt: Double

    /// stable per-photo rest rotation for the tray/print-box thumbnails —
    /// computed once at capture so it doesn't jitter on every re-render
    let restRotation: Double

    @Published var frame: FrameStyle
    @Published var style: PhotoStyle
    @Published var caption: String

    init(rawImage: UIImage, filmGradedImage: UIImage, film: FilmStock, dateTaken: Date = Date()) {
        self.rawImage = rawImage
        self.filmGradedImage = filmGradedImage
        self.film = film
        self.dateTaken = dateTaken
        self.captionTilt = Double.random(in: -2...2)
        self.restRotation = Double.random(in: -4...4)
        self.frame = FrameStyle.all[0]
        self.style = PhotoStyle.all[0]

        let df = DateFormatter()
        df.dateStyle = .short
        self.caption = "\(df.string(from: dateTaken)) · \(film.label)"
    }
}

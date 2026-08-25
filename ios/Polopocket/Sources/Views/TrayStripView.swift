import SwiftUI

/// The strip of just-filed prints resting at the bottom of the viewfinder —
/// tap one to open it in the full-size viewer.
struct TrayStripView: View {
    let prints: [Photo]
    let onSelect: (Photo) -> Void

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 10) {
                ForEach(prints) { photo in
                    Button { onSelect(photo) } label: {
                        Image(uiImage: photo.filmGradedImage)
                            .resizable()
                            .aspectRatio(photo.film.aspect, contentMode: .fill)
                            .frame(width: 54, height: 54 / CGFloat(photo.film.aspect))
                            .clipped()
                            .background(photo.frame.background)
                            .cornerRadius(2)
                            .rotationEffect(.degrees(photo.restRotation))
                            .shadow(color: .black.opacity(0.4), radius: 4, x: 0, y: 2)
                    }
                }
            }
            .padding(.horizontal, 14)
        }
        .frame(height: 70)
    }
}

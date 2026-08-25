import SwiftUI

/// "Print Box" — a grid of every filed print, presented as a bottom sheet.
struct DrawerView: View {
    let prints: [Photo]
    let onSelect: (Photo) -> Void

    private let columns = [GridItem(.adaptive(minimum: 96), spacing: 12)]

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text("Print Box").font(.headline)
                Spacer()
                Text("\(prints.count)")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }
            .padding()

            if prints.isEmpty {
                Spacer()
                Text("Prints will show up here once they're developed")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
                    .padding()
                Spacer()
            } else {
                ScrollView {
                    LazyVGrid(columns: columns, spacing: 12) {
                        ForEach(prints) { photo in
                            Button { onSelect(photo) } label: {
                                Image(uiImage: photo.filmGradedImage)
                                    .resizable()
                                    .aspectRatio(photo.film.aspect, contentMode: .fill)
                                    .frame(height: 96)
                                    .frame(maxWidth: .infinity)
                                    .clipped()
                                    .background(photo.frame.background)
                                    .cornerRadius(3)
                            }
                        }
                    }
                    .padding()
                }
            }
        }
        .background(Color(.systemBackground))
    }
}

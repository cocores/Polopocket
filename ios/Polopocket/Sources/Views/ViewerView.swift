import SwiftUI

/// Full-screen print editor: frame color, bucketed film style, an editable
/// caption, and Save. Mirrors the web app's #viewer.
struct ViewerView: View {
    @ObservedObject var photo: Photo
    let onClose: () -> Void

    @State private var displayImage: UIImage
    @State private var isSaving = false
    @State private var saveMessage: String?

    init(photo: Photo, onClose: @escaping () -> Void) {
        self.photo = photo
        self.onClose = onClose
        self._displayImage = State(initialValue: ImageFilterRenderer.render(photo.filmGradedImage, applying: photo.style.filter))
    }

    var body: some View {
        ZStack {
            Color.charcoalDeep.ignoresSafeArea()

            VStack(spacing: 22) {
                PolaroidCardView(
                    image: displayImage,
                    aspect: photo.film.aspect,
                    overlay: photo.style.overlay,
                    frame: photo.frame,
                    captionTilt: photo.captionTilt,
                    captionBinding: Binding(
                        get: { photo.caption },
                        set: { photo.caption = String($0.prefix(50)) }
                    )
                )
                .frame(maxWidth: 340)

                VStack(alignment: .leading, spacing: 6) {
                    Text("FRAME").styleLabel()
                    FrameSwatchesView(selected: $photo.frame)
                }

                VStack(alignment: .leading, spacing: 6) {
                    Text("FILM STYLE").styleLabel()
                    StyleTabsView(selected: $photo.style)
                }

                Button {
                    save()
                } label: {
                    Label(isSaving ? "Saving…" : "Save Image", systemImage: "square.and.arrow.down")
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                }
                .background(Color.amber)
                .foregroundColor(Color.charcoalDeep)
                .cornerRadius(12)
                .disabled(isSaving)
            }
            .padding(24)

            VStack {
                HStack {
                    Spacer()
                    Button(action: onClose) {
                        Image(systemName: "xmark")
                            .foregroundColor(.white)
                            .padding(10)
                            .background(Circle().fill(Color.white.opacity(0.12)))
                    }
                }
                Spacer()
            }
            .padding()
        }
        .onChange(of: photo.style) { newStyle in
            displayImage = ImageFilterRenderer.render(photo.filmGradedImage, applying: newStyle.filter)
        }
        .alert(saveMessage ?? "", isPresented: Binding(get: { saveMessage != nil }, set: { if !$0 { saveMessage = nil } })) {
            Button("OK", role: .cancel) { saveMessage = nil }
        }
    }

    private func save() {
        isSaving = true
        Haptics.medium()
        Task {
            do {
                try await ImageExporter.savePolaroidCard(for: photo)
                await MainActor.run {
                    isSaving = false
                    Haptics.success()
                    saveMessage = "Saved to Photos"
                }
            } catch {
                await MainActor.run {
                    isSaving = false
                    saveMessage = "Couldn't save: \(error.localizedDescription)"
                }
            }
        }
    }
}

private extension Text {
    func styleLabel() -> some View {
        self.font(.system(size: 9.5, weight: .semibold))
            .tracking(1.2)
            .foregroundColor(Color.creamDim)
    }
}

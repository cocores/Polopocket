import SwiftUI

/// The freshly-ejected print, still "developing": a near-black rectangle
/// swims up into a dark ghost image, then blooms into the film's real
/// color grade — same three-phase idea as the web app's chemical
/// development animation, just compressed to native-app timing. Drag it
/// down toward the tray to file it away early.
struct DevelopingPolaroidView: View {
    let photo: Photo
    let onFiled: () -> Void

    @State private var visiblePhase = 0
    @State private var dragOffset: CGSize = .zero
    @State private var settled = false

    private let blankImage: UIImage
    private let paleImage: UIImage

    init(photo: Photo, onFiled: @escaping () -> Void) {
        self.photo = photo
        self.onFiled = onFiled
        self.blankImage = ImageFilterRenderer.render(photo.rawImage, applying: Self.blankLook)
        self.paleImage = ImageFilterRenderer.render(photo.rawImage, applying: Self.paleLook)
    }

    private static let blankLook = FilterParams(brightness: 0.06, contrast: 1.2, saturation: 0, sepia: 0.3, hueRotate: 150)
    private static let paleLook = FilterParams(brightness: 0.55, contrast: 1.35, saturation: 0.15, sepia: 0.15, hueRotate: 60)

    var body: some View {
        PolaroidCardView(
            crossfading: [blankImage, paleImage, photo.filmGradedImage],
            visibleIndex: visiblePhase,
            aspect: photo.film.aspect,
            frame: photo.frame,
            caption: photo.caption,
            captionTilt: photo.captionTilt,
            isDeveloping: visiblePhase < 2
        )
        .animation(.easeOut(duration: 2.2), value: visiblePhase)
        .frame(maxWidth: 280)
        .rotationEffect(.degrees(settled ? photo.restRotation : 0))
        .offset(dragOffset)
        .opacity(settled ? 1 : 0)
        .scaleEffect(settled ? 1 : 0.94)
        .gesture(
            DragGesture()
                .onChanged { value in dragOffset = value.translation }
                .onEnded { value in
                    // dragging the print down and aside files it into the
                    // tray early, the same "slide it aside" gesture as the
                    // web app; otherwise it springs back and keeps developing.
                    if value.translation.height > 140 {
                        withAnimation(.easeIn(duration: 0.35)) {
                            dragOffset = CGSize(width: value.translation.width, height: 420)
                        }
                        Haptics.light()
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) { onFiled() }
                    } else {
                        withAnimation(.spring()) { dragOffset = .zero }
                    }
                }
        )
        .onAppear {
            withAnimation(.easeOut(duration: 0.4)) { settled = true }
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                withAnimation(.easeOut(duration: 2.2)) { visiblePhase = 1 }
                Haptics.light()
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + 3.6) {
                withAnimation(.easeOut(duration: 2.6)) { visiblePhase = 2 }
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + 6.6) {
                Haptics.medium()
                onFiled()
            }
        }
    }
}

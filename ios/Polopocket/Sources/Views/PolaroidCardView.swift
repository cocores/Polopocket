import SwiftUI

/// The physical print: image + border + handwritten caption. Used for the
/// ejecting/developing print, tray thumbnails, the print box grid, and the
/// full-size viewer — same visual language everywhere, only scale differs.
struct PolaroidCardView: View {
    /// Normally just one image. A developing print passes all three of its
    /// phase images here so they can crossfade via opacity — SwiftUI only
    /// animates properties like opacity, not raw pixel-content swaps, so a
    /// single `image` that changes underneath an animation block would just
    /// pop instead of dissolve.
    let images: [UIImage]
    var visibleIndex: Int = 0
    let aspect: CGFloat
    var overlay: OverlayDescriptor? = nil
    let frame: FrameStyle
    var caption: String = ""
    var captionTilt: Double = 0
    var captionBinding: Binding<String>? = nil
    var isDeveloping: Bool = false

    init(image: UIImage, aspect: CGFloat, overlay: OverlayDescriptor? = nil, frame: FrameStyle,
         caption: String = "", captionTilt: Double = 0, captionBinding: Binding<String>? = nil,
         isDeveloping: Bool = false) {
        self.images = [image]
        self.visibleIndex = 0
        self.aspect = aspect
        self.overlay = overlay
        self.frame = frame
        self.caption = caption
        self.captionTilt = captionTilt
        self.captionBinding = captionBinding
        self.isDeveloping = isDeveloping
    }

    init(crossfading images: [UIImage], visibleIndex: Int, aspect: CGFloat, frame: FrameStyle,
         caption: String = "", captionTilt: Double = 0, isDeveloping: Bool = false) {
        self.images = images
        self.visibleIndex = visibleIndex
        self.aspect = aspect
        self.overlay = nil
        self.frame = frame
        self.caption = caption
        self.captionTilt = captionTilt
        self.captionBinding = nil
        self.isDeveloping = isDeveloping
    }

    var body: some View {
        VStack(spacing: 0) {
            ZStack {
                ForEach(images.indices, id: \.self) { i in
                    Image(uiImage: images[i])
                        .resizable()
                        .aspectRatio(aspect, contentMode: .fill)
                        .opacity(i == visibleIndex ? 1 : 0)
                }
                StyleOverlayView(overlay: overlay)
                if isDeveloping {
                    Color.black.opacity(0.08)
                }
            }
            .aspectRatio(aspect, contentMode: .fit)
            .clipped()
            .padding(EdgeInsets(top: 10, leading: 10, bottom: 6, trailing: 10))

            Group {
                if let captionBinding {
                    TextField("Caption", text: captionBinding)
                        .multilineTextAlignment(.center)
                } else {
                    Text(caption)
                }
            }
            .font(.custom("MarkerFelt-Wide", size: 15))
            .foregroundColor(frame.ink)
            .rotationEffect(.degrees(captionTilt))
            .padding(.bottom, 14)
            .frame(maxWidth: .infinity)
        }
        .background(frame.background)
        .cornerRadius(3)
        .shadow(color: .black.opacity(0.35), radius: 10, x: 0, y: 6)
    }
}

import SwiftUI

struct FrameSwatchesView: View {
    @Binding var selected: FrameStyle

    var body: some View {
        HStack(spacing: 10) {
            ForEach(FrameStyle.all) { frame in
                Button {
                    Haptics.light()
                    selected = frame
                } label: {
                    Circle()
                        .fill(frame.background)
                        .frame(width: 28, height: 28)
                        .overlay(
                            Circle().stroke(Color.white.opacity(frame == selected ? 0.9 : 0.15),
                                            lineWidth: frame == selected ? 2 : 1)
                        )
                }
                .accessibilityLabel(frame.label)
            }
        }
    }
}

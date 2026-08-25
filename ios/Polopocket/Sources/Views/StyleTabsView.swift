import SwiftUI

/// Bucketed Film Style picker — a small category tab row (Classic / Color /
/// Light FX) filters which chips show below it. Switching tabs only changes
/// what's visible; it never changes the photo's actual selection, and this
/// view starts on whichever tab the photo's current style already belongs to.
struct StyleTabsView: View {
    @Binding var selected: PhotoStyle
    @State private var activeGroup: StyleGroup

    init(selected: Binding<PhotoStyle>) {
        self._selected = selected
        self._activeGroup = State(initialValue: selected.wrappedValue.group)
    }

    var body: some View {
        VStack(spacing: 8) {
            HStack(spacing: 6) {
                ForEach(StyleGroup.allCases) { group in
                    Button {
                        Haptics.light()
                        activeGroup = group
                    } label: {
                        Text(group.rawValue.uppercased())
                            .font(.system(size: 9.5, weight: .semibold))
                            .tracking(1)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 4)
                            .background(
                                RoundedRectangle(cornerRadius: 10)
                                    .fill(activeGroup == group ? Color.sage : Color.clear)
                            )
                            .overlay(
                                RoundedRectangle(cornerRadius: 10)
                                    .stroke(Color.white.opacity(0.16), lineWidth: activeGroup == group ? 0 : 1)
                            )
                            .foregroundColor(activeGroup == group ? Color.charcoalDeep : Color.creamDim)
                    }
                }
            }

            HStack(spacing: 8) {
                ForEach(PhotoStyle.styles(in: activeGroup)) { style in
                    Button {
                        Haptics.light()
                        selected = style
                    } label: {
                        Text(style.label)
                            .font(.system(size: 11))
                            .padding(.horizontal, 13)
                            .padding(.vertical, 6)
                            .background(
                                RoundedRectangle(cornerRadius: 14)
                                    .fill(selected == style ? Color.amber : Color.white.opacity(0.06))
                            )
                            .overlay(
                                RoundedRectangle(cornerRadius: 14)
                                    .stroke(Color.white.opacity(selected == style ? 0 : 0.22), lineWidth: 1)
                            )
                            .foregroundColor(selected == style ? Color.charcoalDeep : Color.creamDim)
                    }
                }
            }
            .frame(maxWidth: .infinity)
        }
        .onChange(of: selected) { newValue in
            // if the caller changes the selection out from under us
            // (e.g. loading a different photo), follow it.
            if newValue.group != activeGroup { activeGroup = newValue.group }
        }
    }
}

extension Color {
    static let amber = Color(hex: 0xd98c3f)
    static let sage = Color(hex: 0x8fa88c)
    static let charcoalDeep = Color(hex: 0x1a1714)
    static let creamDim = Color(hex: 0xf2ead9, alpha: 0.75)
}

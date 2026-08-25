import SwiftUI

struct FilmPickerView: View {
    @ObservedObject var store: PhotoStore
    let onClose: () -> Void

    @State private var showUnlockPrompt = false

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text("Choose Film").font(.headline)
                Spacer()
                Button(action: onClose) {
                    Image(systemName: "xmark.circle.fill").foregroundColor(.secondary)
                }
            }
            .padding()

            ScrollView {
                VStack(spacing: 8) {
                    ForEach(Array(FilmStock.all.enumerated()), id: \.offset) { index, film in
                        filmRow(index: index, film: film)
                    }
                }
                .padding(.horizontal)
            }

            if showUnlockPrompt {
                VStack(spacing: 10) {
                    Text("Discontinued stocks (Spectra, Type 500, Type 100, i-Zone) are a premium extra.")
                        .font(.footnote)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                    Button {
                        store.unlockPremium()
                        showUnlockPrompt = false
                        Haptics.success()
                    } label: {
                        Text("🔓 Unlock Premium Films")
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 10)
                    }
                    .background(Color.amber)
                    .foregroundColor(Color.charcoalDeep)
                    .cornerRadius(10)
                }
                .padding()
            }
        }
        .background(Color(.systemBackground))
    }

    private func filmRow(index: Int, film: FilmStock) -> some View {
        let locked = film.isPremium && !store.premiumUnlocked
        let isActive = index == store.filmIndex
        return Button {
            if locked {
                showUnlockPrompt = true
                Haptics.light()
                return
            }
            store.filmIndex = index
            Haptics.medium()
            onClose()
        } label: {
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(film.label).font(.subheadline.weight(.semibold))
                    if film.isPremium {
                        Text("PRO")
                            .font(.system(size: 9, weight: .bold))
                            .padding(.horizontal, 5).padding(.vertical, 1)
                            .background(Color.amber)
                            .foregroundColor(Color.charcoalDeep)
                            .cornerRadius(4)
                    }
                    Spacer()
                    if locked { Image(systemName: "lock.fill").font(.caption) }
                }
                Text(film.note).font(.caption).foregroundColor(.secondary)
            }
            .padding(10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: 10)
                    .fill(isActive ? Color.amber.opacity(0.18) : Color(.secondarySystemBackground))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(isActive ? Color.amber : .clear, lineWidth: 1.5)
            )
            .opacity(locked ? 0.6 : 1)
        }
        .buttonStyle(.plain)
    }
}

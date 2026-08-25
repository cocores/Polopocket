import SwiftUI

struct ContentView: View {
    @StateObject private var store = PhotoStore()
    @StateObject private var camera = CameraController()

    @State private var developingPhotos: [Photo] = []
    @State private var viewerPhoto: Photo?
    @State private var showFilmPicker = false
    @State private var showDrawer = false
    @State private var flashOn = false
    @State private var focusPoint: CGPoint?
    @State private var focusIsTap = false
    @State private var flashFire = false

    var body: some View {
        ZStack {
            GeometryReader { geo in
                let cropRect = cropGuideRect(in: geo.size)

                ZStack {
                    if camera.isAuthorized {
                        CameraPreviewView(controller: camera)
                            .ignoresSafeArea()
                    } else {
                        Color.black.ignoresSafeArea()
                        VStack(spacing: 8) {
                            Text("Camera access needed").foregroundColor(.white).font(.headline)
                            Text("Enable camera access in Settings to use the viewfinder.")
                                .foregroundColor(.white.opacity(0.7))
                                .font(.footnote)
                                .multilineTextAlignment(.center)
                        }
                        .padding(40)
                    }

                    Rectangle()
                        .strokeBorder(Color.white.opacity(0.6), lineWidth: 1.5)
                        .frame(width: cropRect.width, height: cropRect.height)
                        .position(x: cropRect.midX, y: cropRect.midY)
                        .allowsHitTesting(false)

                    ViewfinderHUDView(
                        film: store.currentFilm,
                        onTapFilmHUD: { showFilmPicker = true },
                        focusPoint: focusPoint,
                        focusIsTap: focusIsTap
                    )

                    if flashFire {
                        Color.white.opacity(0.9).ignoresSafeArea()
                    }

                    ForEach(developingPhotos) { photo in
                        DevelopingPolaroidView(photo: photo) {
                            file(photo)
                        }
                        .position(x: geo.size.width / 2, y: geo.size.height * 0.42)
                    }

                    VStack {
                        Spacer()
                        TrayStripView(prints: store.prints) { viewerPhoto = $0 }
                            .padding(.bottom, 120)
                    }
                }
                .contentShape(Rectangle())
                .gesture(
                    SpatialTapGesture().onEnded { value in
                        focusPoint = value.location
                        focusIsTap = true
                        camera.focus(atLayerPoint: value.location, isTap: true)
                    }
                )
                .onAppear {
                    camera.requestAccessAndStart()
                    focusPoint = CGPoint(x: geo.size.width / 2, y: geo.size.height / 2)
                }
                .overlay(alignment: .bottom) {
                    deck(cropRect: cropRect)
                }
                .overlay(alignment: .topTrailing) {
                    Button {
                        showDrawer = true
                    } label: {
                        VStack(spacing: 2) {
                            Image(systemName: "tray.full.fill")
                            Text("\(store.prints.count)").font(.caption2)
                        }
                        .foregroundColor(.white)
                        .padding(10)
                        .background(Circle().fill(Color.black.opacity(0.35)))
                    }
                    .padding()
                    .padding(.top, 40)
                }
            }
        }
        .sheet(isPresented: $showFilmPicker) {
            FilmPickerView(store: store) { showFilmPicker = false }
        }
        .sheet(isPresented: $showDrawer) {
            DrawerView(prints: store.prints) { photo in
                showDrawer = false
                viewerPhoto = photo
            }
        }
        .fullScreenCover(item: $viewerPhoto) { photo in
            ViewerView(photo: photo) { viewerPhoto = nil }
        }
    }

    private func cropGuideRect(in size: CGSize) -> CGRect {
        let aspect = store.currentFilm.aspect
        let maxW = size.width * 0.86
        let maxH = size.height * 0.62
        var w = maxW, h = w / aspect
        if h > maxH { h = maxH; w = h * aspect }
        return CGRect(x: (size.width - w) / 2, y: (size.height - h) / 2 - 20, width: w, height: h)
    }

    private func deck(cropRect: CGRect) -> some View {
        HStack(spacing: 40) {
            Button {
                camera.switchCamera()
            } label: {
                Image(systemName: "arrow.triangle.2.circlepath.camera")
                    .font(.title2)
                    .foregroundColor(.white)
            }

            Button {
                capture(cropRect: cropRect)
            } label: {
                Circle()
                    .fill(Color.white)
                    .frame(width: 70, height: 70)
                    .overlay(Circle().stroke(Color.black.opacity(0.2), lineWidth: 3).padding(4))
            }

            Button {
                flashOn.toggle()
                Haptics.light()
            } label: {
                Image(systemName: flashOn ? "bolt.fill" : "bolt.slash")
                    .font(.title2)
                    .foregroundColor(flashOn ? Color.amber : .white)
            }
        }
        .padding(.bottom, 40)
    }

    private func capture(cropRect: CGRect) {
        Haptics.medium()
        ShutterSound.play()
        if flashOn {
            flashFire = true
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.12) { flashFire = false }
        }
        let film = store.currentFilm
        camera.capturePhoto(cropRectInLayer: cropRect, flashOn: flashOn) { raw in
            guard let raw else { return }
            let graded = ImageFilterRenderer.render(raw, applying: film.finalGrade)
            let photo = Photo(rawImage: raw, filmGradedImage: graded, film: film)
            developingPhotos.append(photo)
        }
    }

    private func file(_ photo: Photo) {
        developingPhotos.removeAll { $0.id == photo.id }
        store.file(photo)
        Haptics.light()
    }
}

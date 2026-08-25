# Polopocket — iOS (Swift/SwiftUI)

A native port of the web Polaroid camera to a real iPhone camera app:
AVFoundation viewfinder, the same 9 film stocks (with the premium-stock
lock/unlock), the same 10 Film Style filters bucketed into Classic / Color /
Light FX tabs, frame swatches, an editable caption, a developing-print
animation you can drag into the tray, a Print Box drawer, and Save Image →
Photos.

This directory ships as **source only** (no `.xcodeproj`) so it opens
cleanly in whatever Xcode version you have, rather than risking a
hand-generated project file that fails to load. Setup takes about two
minutes:

## 1. Create the Xcode project

1. Xcode → **File → New → Project… → iOS → App**.
2. Product Name: `Polopocket`. Interface: **SwiftUI**. Language: **Swift**.
   Uncheck "Include Tests" (optional).
3. Save it anywhere — e.g. right here as `ios/Polopocket.xcodeproj`, alongside
   this `Sources` folder (recommended so it stays with the rest of the repo).

## 2. Add the source files

1. Delete the generated `ContentView.swift` (this port has its own).
2. In Xcode's Project Navigator, right-click the app target's group → **Add
   Files to "Polopocket"…**, select this directory's `Sources` folder, and
   make sure **"Create groups"** and **"Copy items if needed"** (uncheck if
   you saved the project inside `ios/` — you don't want a duplicate copy) are
   set appropriately, with the app target checked.
3. You should end up with `Models`, `Filters`, `Store`, `Camera`, `Views`,
   `Export`, `Support` groups plus `PolopocketApp.swift` at the top level.

## 3. Info.plist permissions

Camera and Photos access need usage-description strings or the app will
crash on first use. Add these keys (Target → Info tab, or edit
`Info.plist` directly):

| Key | Value |
|---|---|
| `NSCameraUsageDescription` | "Polopocket needs the camera to take Polaroid-style photos." |
| `NSPhotoLibraryAddUsageDescription` | "Polopocket saves your finished prints to Photos." |

## 4. Deployment target

Set the target's minimum deployment to **iOS 16.0** (used for
`fullScreenCover(item:)`, the modern `Task`/`async` Photos APIs, and
`SpatialTapGesture`).

## 5. Run on a real device

The Simulator has no camera, so `CameraController` will just show the
"Camera access needed" placeholder there — build to a physical iPhone to
see the live viewfinder, shutter, and Save Image flow. Sign the target with
your Apple ID under **Signing & Capabilities** the first time you run.

## What's a deliberate simplification vs. the web version

- **Caption font**: the web app uses Google's "Permanent Marker" webfont.
  iOS doesn't ship that font, so the port uses the built-in "Marker Felt"
  family (`MarkerFelt-Wide`) as the closest system equivalent. To match
  exactly, add the `.ttf` to the Xcode project, register it in
  `Info.plist` under `UIAppFonts`, and swap the font name in
  `PolaroidCardView.swift` and `ImageExporter.swift`.
- **Development timing**: the web version's chemical-development animation
  runs ~29 seconds for realism as a browser novelty. `DevelopingPolaroidView`
  compresses that to ~6.5 seconds, which reads better in daily use as an
  actual camera app — tune the constants there if you want it slower.
- **Shake-to-fast-forward**: the web app listens for `devicemotion` to skip
  the development animation on a shake. Not ported (drag-to-file already
  covers "get it out of the way faster"); add a `CMMotionManager` accelerometer
  listener in `ContentView` if you want it back.
- **Discontinued-film unlock**: like the web version, this is a cosmetic
  local flag (`UserDefaults`/`PhotoStore.premiumUnlocked`), not a real
  StoreKit purchase — wire up StoreKit if you want it to actually gate content.

## Project layout

```
Sources/
  PolopocketApp.swift        — @main entry point
  Models/                    — FilmStock, FrameStyle, PhotoStyle (+ StyleGroup), Photo, FilterParams
  Filters/                   — FilterParams→CoreImage pipeline, overlay gradient rendering (live + baked)
  Store/                     — PhotoStore (film selection, Print Box, premium unlock)
  Camera/                    — CameraController (AVFoundation), CameraPreviewView
  Views/                     — ContentView (root), ViewerView, FilmPickerView, DrawerView,
                                TrayStripView, DevelopingPolaroidView, PolaroidCardView,
                                FrameSwatchesView, StyleTabsView, ViewfinderHUDView
  Export/                    — ImageExporter (bakes frame + style + caption, saves to Photos)
  Support/                   — Haptics, ShutterSound (synthesized capture sound)
```

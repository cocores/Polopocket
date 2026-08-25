import AVFoundation

/// A synthesized mechanical clack + short motor whir, played on capture —
/// there's no real Polaroid recording to draw from, so it's built from a
/// noise burst and a couple of ramped oscillators, same idea as the web
/// app's Web Audio version, just generated as one short PCM buffer.
enum ShutterSound {
    private static var engine: AVAudioEngine?
    private static var player: AVAudioPlayerNode?

    static func play() {
        let sampleRate = 44100.0
        let duration = 0.9
        let frameCount = AVAudioFrameCount(sampleRate * duration)
        guard let format = AVAudioFormat(standardFormatWithSampleRate: sampleRate, channels: 1),
              let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frameCount) else { return }
        buffer.frameLength = frameCount
        guard let samples = buffer.floatChannelData?[0] else { return }

        for i in 0..<Int(frameCount) {
            let t = Double(i) / sampleRate
            var s = 0.0

            // mechanical click: 50ms decaying noise burst
            if t < 0.05 {
                s += (Double.random(in: -1...1)) * exp(-t * 90) * 0.6
            }
            // low thunk: falling sine
            if t < 0.09 {
                let freq = 180 * pow(60.0 / 180.0, t / 0.08)
                s += sin(2 * .pi * freq * t) * exp(-t * 40) * 0.4
            }
            // motor whir starting shortly after, decaying over the rest of the clip
            if t > 0.08 {
                let wt = t - 0.08
                let whirDur = duration - 0.08
                let envelope = min(wt / 0.06, 1) * exp(-max(0, wt - (whirDur - 0.25)) * 12)
                let freq = 90 + 20 * min(wt / 0.15, 1)
                s += sin(2 * .pi * freq * wt) * envelope * 0.16
                s += Double.random(in: -1...1) * envelope * 0.03
            }
            samples[i] = Float(max(-1, min(1, s)))
        }

        let engine = self.engine ?? AVAudioEngine()
        let player = self.player ?? AVAudioPlayerNode()
        if self.engine == nil {
            engine.attach(player)
            engine.connect(player, to: engine.mainMixerNode, format: format)
            try? engine.start()
            self.engine = engine
            self.player = player
        }
        player.scheduleBuffer(buffer, at: nil, options: .interrupts)
        player.play()
    }
}

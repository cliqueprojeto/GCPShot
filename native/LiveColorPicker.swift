import Cocoa
import CoreGraphics
import ScreenCaptureKit

final class SelectionWindow: NSWindow {
    override var canBecomeKey: Bool { true }
}

final class SelectionView: NSView {
    var pick: (() -> Void)?
    var cancel: (() -> Void)?
    override var acceptsFirstResponder: Bool { true }
    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }
    override func mouseDown(with event: NSEvent) { pick?() }
    override func rightMouseDown(with event: NSEvent) { cancel?() }
    override func keyDown(with event: NSEvent) {
        if event.keyCode == 53 { cancel?() }
        else if event.keyCode == 36 || event.keyCode == 76 { pick?() }
    }
}

final class MagnifierView: NSView {
    var image: CGImage?
    var hex = "#000000"
    var channels = [0, 0, 0]
    var samplePoint = NSPoint(x: 13, y: 6)
    override var isFlipped: Bool { true }
    override func draw(_ rect: NSRect) {
        NSColor(calibratedRed: 0.067, green: 0.082, blue: 0.118, alpha: 1).setFill()
        bounds.fill()
        if let image = image {
            NSGraphicsContext.current?.imageInterpolation = .none
            NSImage(cgImage: image, size: NSSize(width: 27, height: 13)).draw(in: NSRect(x: 12, y: 12, width: 243, height: 117))
        }
        let border = NSColor(calibratedRed: 0.61, green: 0.63, blue: 1, alpha: 1)
        border.setStroke()
        NSBezierPath(rect: bounds.insetBy(dx: 0.5, dy: 0.5)).stroke()
        NSBezierPath(rect: NSRect(x: 12 + samplePoint.x * 9, y: 12 + samplePoint.y * 9, width: 8, height: 8)).stroke()
        let base: [NSAttributedString.Key: Any] = [.font: NSFont.systemFont(ofSize: 11), .foregroundColor: NSColor.white]
        ("\(hex)   rgb(\(channels[0]), \(channels[1]), \(channels[2]))" as NSString).draw(at: NSPoint(x: 11, y: 137), withAttributes: base)
        let muted: [NSAttributedString.Key: Any] = [.font: NSFont.systemFont(ofSize: 11), .foregroundColor: NSColor(calibratedRed: 0.64, green: 0.71, blue: 0.89, alpha: 1)]
        ("GCPShot - Clique ou Enter para copiar" as NSString).draw(at: NSPoint(x: 11, y: 158), withAttributes: muted)
        ("Esc cancela - Amostragem em tempo real" as NSString).draw(at: NSPoint(x: 11, y: 177), withAttributes: muted)
    }
}

@available(macOS 14.0, *)
@MainActor final class Picker {
    var overlays: [NSWindow] = []
    let panel = NSPanel(contentRect: NSRect(x: 0, y: 0, width: 267, height: 198), styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: false)
    let preview = MagnifierView(frame: NSRect(x: 0, y: 0, width: 267, height: 198))
    var content: SCShareableContent?
    var finished = false
    var hasSample = false
    var eventMonitor: Any?
    var watchdog: Timer?
    var lastSampleAt = Date()
    var samplingStarted = false
    let startedAt = Date()
    let testMode = CommandLine.arguments.first(where: { $0.hasPrefix("--test-") })
    let parent = CommandLine.arguments.count > 1 ? Int32(CommandLine.arguments[1]) ?? 0 : 0

    func start() async {
        watchdog = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
            guard let self = self else { return }
            if self.parent > 0 && kill(self.parent, 0) != 0 { self.finish("CANCEL"); return }
            if Date().timeIntervalSince(self.startedAt) > 120 { self.finish("CANCEL"); return }
            if self.samplingStarted && Date().timeIntervalSince(self.lastSampleAt) > 15 {
                self.fail("A amostragem de tela parou de responder. Verifique a permissao de Gravacao de Tela do GCPShot nos Ajustes do Sistema.")
            }
        }
        if testMode == nil {
            guard CGPreflightScreenCaptureAccess() || CGRequestScreenCaptureAccess() else {
                fail("Permita a gravacao de tela para GCPShot nos Ajustes do Sistema > Privacidade e Seguranca e abra o aplicativo novamente.")
                return
            }
            samplingStarted = true
            lastSampleAt = Date()
            do { content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: true) }
            catch { fail(error.localizedDescription); return }
        }
        eventMonitor = NSEvent.addLocalMonitorForEvents(matching: [.keyDown, .leftMouseDown, .rightMouseDown]) { [weak self] event in
            guard let self = self else { return event }
            switch event.type {
            case .leftMouseDown: self.confirm(); return nil
            case .rightMouseDown: self.finish("CANCEL"); return nil
            case .keyDown:
                if event.keyCode == 53 { self.finish("CANCEL"); return nil }
                if event.keyCode == 36 || event.keyCode == 76 { self.confirm(); return nil }
            default: break
            }
            return event
        }
        for screen in NSScreen.screens {
            let window = SelectionWindow(contentRect: screen.frame, styleMask: .borderless, backing: .buffered, defer: false)
            // Fully transparent areas can pass clicks to windows underneath on macOS.
            window.backgroundColor = NSColor.black.withAlphaComponent(0.01)
            window.isOpaque = false
            window.hasShadow = false
            window.ignoresMouseEvents = false
            window.isReleasedWhenClosed = false
            window.level = NSWindow.Level(rawValue: NSWindow.Level.screenSaver.rawValue - 1)
            window.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
            window.sharingType = .none
            let view = SelectionView(frame: NSRect(origin: .zero, size: screen.frame.size))
            view.pick = { [weak self] in self?.confirm() }
            view.cancel = { [weak self] in self?.finish("CANCEL") }
            window.contentView = view
            window.makeKeyAndOrderFront(nil)
            window.makeFirstResponder(view)
            overlays.append(window)
        }
        panel.contentView = preview
        panel.level = .screenSaver
        panel.sharingType = .none
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        panel.ignoresMouseEvents = true
        panel.orderFrontRegardless()
        NSApp.activate(ignoringOtherApps: true)
        let target = overlays.first(where: { $0.frame.contains(NSEvent.mouseLocation) }) ?? overlays.first
        target?.makeKeyAndOrderFront(nil)
        target?.makeFirstResponder(target?.contentView)
        if let testMode = testMode {
            if testMode == "--test-stalled" {
                samplingStarted = true
                lastSampleAt = Date(timeIntervalSinceNow: -16)
                while !finished { try? await Task.sleep(nanoseconds: 40_000_000) }
                return
            }
            runEventTest(testMode, window: target)
            while !finished { try? await Task.sleep(nanoseconds: 40_000_000) }
            return
        }
        do { content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: true) }
        catch { fail(error.localizedDescription); return }
        print("READY"); fflush(stdout)
        while !finished {
            if parent > 0 && kill(parent, 0) != 0 { finish("CANCEL"); return }
            _ = await sample()
            try? await Task.sleep(nanoseconds: 40_000_000)
        }
    }

    func confirm() {
        // Commit the displayed sample without waiting for another ScreenCaptureKit request.
        if hasSample { finish(preview.hex) }
    }

    func runEventTest(_ mode: String, window: NSWindow?) {
        guard let window = window, let view = window.contentView as? SelectionView,
              view.acceptsFirstMouse(for: nil), !window.ignoresMouseEvents,
              window.backgroundColor.alphaComponent > 0 else {
            fail("Picker input window is not interactive."); return
        }
        preview.hex = "#5F42EB"
        hasSample = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            let event: NSEvent?
            if mode == "--test-click" || mode == "--test-right-click" {
                event = NSEvent.mouseEvent(with: mode == "--test-click" ? .leftMouseDown : .rightMouseDown,
                    location: NSPoint(x: 20, y: 20), modifierFlags: [], timestamp: 0,
                    windowNumber: window.windowNumber, context: nil, eventNumber: 1, clickCount: 1, pressure: 1)
            } else {
                let key: UInt16 = mode == "--test-escape" ? 53 : (mode == "--test-keypad-enter" ? 76 : 36)
                event = NSEvent.keyEvent(with: .keyDown, location: .zero, modifierFlags: [], timestamp: 0,
                    windowNumber: window.windowNumber, context: nil, characters: "\r",
                    charactersIgnoringModifiers: "\r", isARepeat: false, keyCode: key)
            }
            guard let event = event else { self.fail("Unable to create AppKit test event."); return }
            NSApp.postEvent(event, atStart: false)
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 5) { self.fail("AppKit input event did not finish the picker.") }
    }

    func sample() async -> Bool {
        guard !finished, let content = content, let position = CGEvent(source: nil)?.location,
              let display = content.displays.first(where: { $0.frame.contains(position) }) else { return false }
        let filter = SCContentFilter(display: display, excludingApplications: content.applications.filter { $0.processID == ProcessInfo.processInfo.processIdentifier }, exceptingWindows: [])
        let config = SCStreamConfiguration()
        let scale = CGFloat(display.width) / display.frame.width
        let width = 27 / scale, height = 13 / scale
        let px = max(0, min(position.x - display.frame.minX - 13 / scale, display.frame.width - width))
        let py = max(0, min(position.y - display.frame.minY - 6 / scale, display.frame.height - height))
        config.sourceRect = CGRect(x: px, y: py, width: width, height: height)
        config.width = 27; config.height = 13
        config.showsCursor = false
        do {
            let image = try await SCScreenshotManager.captureImage(contentFilter: filter, configuration: config)
            if finished { return false }
            let bitmap = NSBitmapImageRep(cgImage: image)
            let sampleX = max(0, min(26, Int((position.x - display.frame.minX - px) * scale)))
            let sampleY = max(0, min(12, Int((position.y - display.frame.minY - py) * scale)))
            guard let color = bitmap.colorAt(x: sampleX, y: sampleY)?.usingColorSpace(.sRGB) else { return false }
            let values = [color.redComponent, color.greenComponent, color.blueComponent].map { Int(($0 * 255).rounded()) }
            preview.channels = values
            preview.samplePoint = NSPoint(x: sampleX, y: sampleY)
            preview.hex = String(format: "#%02X%02X%02X", values[0], values[1], values[2])
            preview.image = image
            hasSample = true
            lastSampleAt = Date()
            preview.needsDisplay = true
            let mouse = NSEvent.mouseLocation
            let area = NSScreen.screens.first(where: { $0.frame.contains(mouse) })?.visibleFrame ?? NSScreen.main!.visibleFrame
            var x = mouse.x + 24, y = mouse.y - 222
            if x + 267 > area.maxX { x = mouse.x - 291 }
            if y < area.minY { y = mouse.y + 24 }
            panel.setFrameOrigin(NSPoint(x: max(area.minX, min(x, area.maxX - 267)), y: max(area.minY, min(y, area.maxY - 198))))
            return true
        } catch { fail(error.localizedDescription); return false }
    }

    func finish(_ result: String) {
        if finished { return }
        finished = true
        cleanup()
        print(result); fflush(stdout)
        exit(0)
    }
    func fail(_ text: String) {
        if finished { return }
        finished = true
        cleanup()
        FileHandle.standardError.write(Data((text + "\n").utf8))
        exit(1)
    }

    func cleanup() {
        watchdog?.invalidate()
        watchdog = nil
        if let monitor = eventMonitor { NSEvent.removeMonitor(monitor) }
        eventMonitor = nil
        panel.orderOut(nil)
        for window in overlays { window.orderOut(nil); window.close() }
        overlays.removeAll()
    }
}

let app = NSApplication.shared
app.setActivationPolicy(.accessory)
if #available(macOS 14.0, *) {
    Task { @MainActor in
        let picker = Picker()
        await picker.start()
    }
    app.run()
} else {
    FileHandle.standardError.write(Data("Live Color requer macOS 14 ou posterior.\n".utf8))
    exit(1)
}

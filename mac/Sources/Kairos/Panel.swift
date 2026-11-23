import AppKit
import SwiftUI

/// Borderless panel that can still take keyboard focus for the quick-add field.
final class GlassPanel: NSPanel {
    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { false }
}

@MainActor
final class PanelController {
    private let panel: GlassPanel
    private let store: TaskStore

    init(store: TaskStore) {
        self.store = store
        panel = GlassPanel(
            contentRect: NSRect(x: 0, y: 0, width: 360, height: 540),
            styleMask: [.borderless, .nonactivatingPanel, .resizable, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )
        panel.isOpaque = false
        panel.backgroundColor = .clear
        panel.hasShadow = true
        panel.isMovableByWindowBackground = true
        panel.hidesOnDeactivate = false
        panel.isReleasedWhenClosed = false
        panel.collectionBehavior = [.canJoinAllSpaces, .stationary, .fullScreenAuxiliary, .ignoresCycle]
        panel.minSize = NSSize(width: 280, height: 260)

        let glass = NSVisualEffectView()
        glass.material = .hudWindow
        glass.blendingMode = .behindWindow
        glass.state = .active
        glass.maskImage = Self.roundedMask(radius: 22)

        let host = NSHostingView(rootView: WidgetView(store: store, onDismiss: { [weak self] in self?.dismiss() }))
        host.translatesAutoresizingMaskIntoConstraints = false
        glass.addSubview(host)
        NSLayoutConstraint.activate([
            host.leadingAnchor.constraint(equalTo: glass.leadingAnchor),
            host.trailingAnchor.constraint(equalTo: glass.trailingAnchor),
            host.topAnchor.constraint(equalTo: glass.topAnchor),
            host.bottomAnchor.constraint(equalTo: glass.bottomAnchor),
        ])
        panel.contentView = glass

        if !panel.setFrameUsingName("KairosPanel"), let screen = NSScreen.main?.visibleFrame {
            panel.setFrameOrigin(NSPoint(x: screen.maxX - 380, y: screen.maxY - 560))
        }
        panel.setFrameAutosaveName("KairosPanel")
        applyLevel()
    }

    private static func roundedMask(radius: CGFloat) -> NSImage {
        let edge = radius * 2 + 1
        let image = NSImage(size: NSSize(width: edge, height: edge), flipped: false) { rect in
            NSColor.black.setFill()
            NSBezierPath(roundedRect: rect, xRadius: radius, yRadius: radius).fill()
            return true
        }
        image.capInsets = NSEdgeInsets(top: radius, left: radius, bottom: radius, right: radius)
        image.resizingMode = .stretch
        return image
    }

    private var desktopLevel: NSWindow.Level {
        NSWindow.Level(rawValue: Int(CGWindowLevelForKey(.desktopIconWindow)) + 1)
    }

    func applyLevel() {
        panel.level = AppSettings.pinToDesktop ? desktopLevel : .floating
    }

    func show() {
        panel.orderFrontRegardless()
    }

    func toggleVisible() {
        if panel.isVisible { panel.orderOut(nil) } else { show() }
    }

    /// Bring the widget to the front with the quick-add box focused.
    func summon(showSettings: Bool = false) {
        panel.level = .floating
        NSApp.activate(ignoringOtherApps: true)
        panel.makeKeyAndOrderFront(nil)
        store.showSettings = showSettings || !AppSettings.isConfigured
        store.focusRequest += 1
        Task { await store.refresh() }
    }

    /// Escape or after adding: drop back to the resting level and give focus back.
    func dismiss() {
        applyLevel()
        panel.resignKey()
        NSApp.deactivate()
    }
}

import AppKit
import ServiceManagement
import SwiftUI

@main
struct KairosApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var delegate

    var body: some Scene {
        MenuBarExtra("Kairos", systemImage: "clock.badge.checkmark") {
            MenuContent(delegate: delegate)
        }
    }
}

struct MenuContent: View {
    let delegate: AppDelegate
    @AppStorage(AppSettings.pinKey) private var pinToDesktop = false
    @State private var openAtLogin = SMAppService.mainApp.status == .enabled

    var body: some View {
        Button("Quick Add  (⌃⌥Space)") { delegate.panel?.summon() }
        Button("Show / Hide Widget") { delegate.panel?.toggleVisible() }
        Button("Refresh") { Task { await delegate.store.refresh() } }
        Divider()
        Toggle("Pin to Desktop (behind windows)", isOn: $pinToDesktop)
            .onChange(of: pinToDesktop) { _, _ in delegate.panel?.applyLevel() }
        Toggle("Open at Login", isOn: $openAtLogin)
            .onChange(of: openAtLogin) { _, on in
                do {
                    if on { try SMAppService.mainApp.register() } else { try SMAppService.mainApp.unregister() }
                } catch {
                    openAtLogin = SMAppService.mainApp.status == .enabled
                }
            }
        Button("Settings…") { delegate.panel?.summon(showSettings: true) }
        Divider()
        Button("Quit Kairos") { NSApp.terminate(nil) }.keyboardShortcut("q")
    }
}

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate {
    let store = TaskStore()
    var panel: PanelController?
    private var hotKey: HotKey?

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.accessory)
        let panel = PanelController(store: store)
        self.panel = panel
        panel.show()
        // ⌃⌥Space: summon the widget with the quick-add box focused, ready for Wispr Flow.
        hotKey = HotKey(keyCode: HotKey.space, modifiers: HotKey.control | HotKey.option) { [weak panel] in
            panel?.summon()
        }
        Task { await store.refresh() }
        store.startAutoRefresh()
    }
}

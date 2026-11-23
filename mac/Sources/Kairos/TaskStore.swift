import Foundation
import SwiftUI

@MainActor
final class TaskStore: ObservableObject {
    @Published var tasks: [KTask] = []
    @Published var status: String?
    @Published var isError = false
    @Published var isAdding = false
    @Published var loaded = false
    @Published var showSettings = !AppSettings.isConfigured
    @Published var focusRequest = 0

    private var timer: Timer?

    func startAutoRefresh() {
        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: 120, repeats: true) { [weak self] _ in
            Task { await self?.refresh() }
        }
    }

    func refresh() async {
        guard AppSettings.isConfigured else { return }
        let start = Calendar.current.startOfDay(for: Date())
        let end = Calendar.current.date(byAdding: .day, value: 8, to: start)!
        do {
            tasks = try await API.tasks(from: start, to: end)
            loaded = true
            if isError { status = nil; isError = false }
        } catch {
            show(error)
        }
    }

    /// Returns true when the task was added, so the view can clear the field.
    func add(_ text: String) async -> Bool {
        let note = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !note.isEmpty, !isAdding else { return false }
        isAdding = true
        status = "Adding…"
        isError = false
        defer { isAdding = false }
        do {
            let p = try await API.add(note)
            status = "Added “\(p.title)”" + (p.startTime.map { " at \($0)" } ?? "")
            await refresh()
            return true
        } catch {
            show(error)
            return false
        }
    }

    func toggle(_ task: KTask) async {
        guard let i = tasks.firstIndex(where: { $0.id == task.id }) else { return }
        tasks[i].done.toggle()
        do { try await API.setDone(task.id, tasks[i].done) } catch { show(error); await refresh() }
    }

    func delete(_ task: KTask) async {
        tasks.removeAll { $0.id == task.id }
        do { try await API.delete(task.id) } catch { show(error); await refresh() }
    }

    private func show(_ error: Error) {
        status = error.localizedDescription
        isError = true
    }

    struct DayGroup: Identifiable {
        let day: Date
        let tasks: [KTask]
        var id: Date { day }
    }

    /// Tasks grouped by local day, in order.
    var days: [DayGroup] {
        let cal = Calendar.current
        let grouped = Dictionary(grouping: tasks) { cal.startOfDay(for: $0.startDate ?? .distantFuture) }
        return grouped.keys.sorted().map { day in
            DayGroup(day: day, tasks: grouped[day]!.sorted { a, b in
                if a.allDay != b.allDay { return a.allDay }
                return (a.startDate ?? .distantFuture) < (b.startDate ?? .distantFuture)
            })
        }
    }
}

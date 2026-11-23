import SwiftUI

struct WidgetView: View {
    @ObservedObject var store: TaskStore
    let onDismiss: () -> Void
    @State private var text = ""
    @FocusState private var composerFocused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            header
            if store.showSettings {
                SettingsView(store: store)
            } else {
                list
                composer
            }
        }
        .foregroundStyle(.primary)
        .onChange(of: store.focusRequest) { _, _ in
            DispatchQueue.main.async { composerFocused = !store.showSettings }
        }
    }

    private var header: some View {
        HStack(alignment: .firstTextBaseline) {
            VStack(alignment: .leading, spacing: 1) {
                Text("Kairos").font(.system(size: 22, weight: .bold, design: .rounded))
                Text(Date.now.formatted(.dateTime.weekday(.wide).month(.wide).day()))
                    .font(.subheadline).foregroundStyle(.secondary)
            }
            Spacer()
            Button { Task { await store.refresh() } } label: { Image(systemName: "arrow.clockwise") }
                .help("Refresh")
            Button { store.showSettings.toggle() } label: { Image(systemName: store.showSettings ? "xmark" : "gearshape") }
                .help("Settings")
        }
        .buttonStyle(.borderless)
        .padding(.horizontal, 18)
        .padding(.top, 16)
        .padding(.bottom, 8)
    }

    private var list: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 12) {
                if store.loaded && store.tasks.isEmpty {
                    Text("Nothing scheduled this week.")
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity)
                        .padding(.top, 30)
                }
                ForEach(store.days) { group in
                    VStack(alignment: .leading, spacing: 2) {
                        Text(dayLabel(group.day).uppercased())
                            .font(.caption.weight(.semibold))
                            .tracking(0.8)
                            .foregroundStyle(.secondary)
                            .padding(.leading, 4)
                            .padding(.bottom, 2)
                        ForEach(group.tasks) { task in
                            TaskRow(task: task, store: store)
                        }
                    }
                }
            }
            .padding(.horizontal, 14)
            .padding(.bottom, 10)
        }
        .scrollIndicators(.never)
    }

    private var composer: some View {
        VStack(alignment: .leading, spacing: 6) {
            if let status = store.status {
                Text(status)
                    .font(.caption)
                    .foregroundStyle(store.isError ? Color.red : Color.secondary)
                    .lineLimit(2)
            }
            HStack(alignment: .bottom, spacing: 8) {
                TextField("Add a task… “gym tomorrow at 6”", text: $text, axis: .vertical)
                    .textFieldStyle(.plain)
                    .font(.system(size: 14))
                    .lineLimit(1...4)
                    .focused($composerFocused)
                    .onSubmit(submit)
                    .onKeyPress(.escape) {
                        onDismiss()
                        return .handled
                    }
                if store.isAdding {
                    ProgressView().controlSize(.small)
                } else {
                    Button(action: submit) { Image(systemName: "arrow.up.circle.fill").font(.system(size: 20)) }
                        .buttonStyle(.borderless)
                        .disabled(text.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
            .padding(10)
            .background(.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(.white.opacity(0.12)))
        }
        .padding(14)
    }

    private func submit() {
        let note = text
        Task {
            if await store.add(note) {
                text = ""
                try? await Task.sleep(for: .seconds(1.2))
                onDismiss()
            }
        }
    }

    private func dayLabel(_ day: Date) -> String {
        let cal = Calendar.current
        if cal.isDateInToday(day) { return "Today" }
        if cal.isDateInTomorrow(day) { return "Tomorrow" }
        return day.formatted(.dateTime.weekday(.wide).month(.abbreviated).day())
    }
}

struct TaskRow: View {
    let task: KTask
    @ObservedObject var store: TaskStore
    @State private var hovering = false

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            if task.isTask {
                Button { Task { await store.toggle(task) } } label: {
                    Image(systemName: task.done ? "checkmark.circle.fill" : "circle")
                        .font(.system(size: 16))
                        .foregroundStyle(task.done ? Color.accentColor : Color.secondary)
                }
                .buttonStyle(.borderless)
            } else {
                Circle().fill(Color(hex: task.color)).frame(width: 8, height: 8).padding(.horizontal, 4).padding(.top, 5)
            }
            VStack(alignment: .leading, spacing: 1) {
                Text(task.title)
                    .font(.system(size: 13.5, weight: .medium))
                    .strikethrough(task.done)
                    .foregroundStyle(task.done ? .secondary : .primary)
                Text(timeLabel + (task.isTask ? "" : " · \(task.calendar)"))
                    .font(.caption).foregroundStyle(.secondary)
                if !task.description.isEmpty {
                    Text(task.description).font(.caption).foregroundStyle(.secondary).lineLimit(2)
                }
            }
            Spacer(minLength: 0)
            if task.isTask && hovering {
                Button { Task { await store.delete(task) } } label: { Image(systemName: "trash") }
                    .buttonStyle(.borderless)
                    .foregroundStyle(.secondary)
                    .help("Delete task")
            }
        }
        .padding(.vertical, 6)
        .padding(.horizontal, 8)
        .background(.white.opacity(hovering ? 0.08 : 0.04), in: RoundedRectangle(cornerRadius: 10))
        .onHover { hovering = $0 }
    }

    private var timeLabel: String {
        guard !task.allDay, let s = task.startDate else { return "All day" }
        let start = s.formatted(date: .omitted, time: .shortened)
        guard let e = task.endDate else { return start }
        return "\(start) – \(e.formatted(date: .omitted, time: .shortened))"
    }
}

struct SettingsView: View {
    @ObservedObject var store: TaskStore
    @AppStorage(AppSettings.urlKey) private var serverURL = "http://localhost:3000"
    @AppStorage(AppSettings.tokenKey) private var token = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Connect to your Kairos server").font(.headline)
            VStack(alignment: .leading, spacing: 4) {
                Text("Server URL").font(.caption).foregroundStyle(.secondary)
                TextField("https://kairos--project.us-central1.hosted.app", text: $serverURL).textFieldStyle(.roundedBorder)
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("Passcode (KAIROS_TOKEN)").font(.caption).foregroundStyle(.secondary)
                SecureField("Passcode", text: $token).textFieldStyle(.roundedBorder)
            }
            Button("Save and Connect") {
                store.showSettings = false
                store.focusRequest += 1
                Task { await store.refresh() }
            }
            .keyboardShortcut(.defaultAction)
            .disabled(token.isEmpty)
            Text("Shortcut: ⌃⌥Space opens quick add from anywhere. Dictate with Wispr Flow, press Return to add, Esc to dismiss.")
                .font(.caption).foregroundStyle(.secondary)
            Spacer()
        }
        .padding(18)
    }
}

extension Color {
    init(hex: String) {
        let s = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
        let v = UInt64(s, radix: 16) ?? 0x7AA2F7
        self.init(red: Double((v >> 16) & 0xFF) / 255, green: Double((v >> 8) & 0xFF) / 255, blue: Double(v & 0xFF) / 255)
    }
}

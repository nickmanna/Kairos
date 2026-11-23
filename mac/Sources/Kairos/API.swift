import Foundation

struct KTask: Codable, Identifiable, Hashable {
    let id: String
    let title: String
    let description: String
    let start: String
    let end: String
    let allDay: Bool
    var done: Bool
    let isTask: Bool
    let calendar: String
    let color: String

    var startDate: Date? { KTask.parse(start, allDay: allDay) }
    var endDate: Date? { KTask.parse(end, allDay: allDay) }

    private static let iso = ISO8601DateFormatter()
    private static let isoFractional: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()
    private static let day: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.locale = Locale(identifier: "en_US_POSIX")
        return f
    }()

    static func parse(_ s: String, allDay: Bool) -> Date? {
        allDay ? day.date(from: s) : (iso.date(from: s) ?? isoFractional.date(from: s))
    }
}

struct ParsedTask: Codable {
    let title: String
    let date: String
    let startTime: String?
}

struct APIError: LocalizedError {
    let message: String
    var errorDescription: String? { message }
}

enum API {
    private static let encoder = JSONEncoder()

    private static func request(_ path: String, method: String = "GET", body: [String: AnyEncodable]? = nil) async throws -> Data {
        guard let url = URL(string: AppSettings.serverURL + path) else { throw APIError(message: "Server URL looks wrong.") }
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.timeoutInterval = 60
        req.setValue("Bearer \(AppSettings.token)", forHTTPHeaderField: "Authorization")
        if let body {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try encoder.encode(body)
        }
        let (data, response) = try await URLSession.shared.data(for: req)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(status) else {
            if status == 401 { throw APIError(message: "Passcode rejected. Check Settings.") }
            let msg = (try? JSONDecoder().decode([String: String].self, from: data))?["error"]
            throw APIError(message: msg ?? "Server error \(status).")
        }
        return data
    }

    static func tasks(from: Date, to: Date) async throws -> [KTask] {
        let f = ISO8601DateFormatter()
        let q = "?from=\(f.string(from: from))&to=\(f.string(from: to))"
            .addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed.subtracting(CharacterSet(charactersIn: "+"))) ?? ""
        let data = try await request("/api/tasks" + q)
        struct Response: Decodable { let tasks: [KTask] }
        return try JSONDecoder().decode(Response.self, from: data).tasks
    }

    static func add(_ text: String) async throws -> ParsedTask {
        let data = try await request("/api/tasks", method: "POST", body: [
            "text": AnyEncodable(text),
            "timeZone": AnyEncodable(TimeZone.current.identifier),
        ])
        struct Response: Decodable { let task: ParsedTask }
        return try JSONDecoder().decode(Response.self, from: data).task
    }

    static func setDone(_ id: String, _ done: Bool) async throws {
        _ = try await request("/api/tasks/\(id)", method: "PATCH", body: ["done": AnyEncodable(done)])
    }

    static func delete(_ id: String) async throws {
        _ = try await request("/api/tasks/\(id)", method: "DELETE")
    }
}

struct AnyEncodable: Encodable {
    private let encodeValue: (Encoder) throws -> Void
    init<T: Encodable>(_ value: T) { encodeValue = value.encode }
    func encode(to encoder: Encoder) throws { try encodeValue(encoder) }
}

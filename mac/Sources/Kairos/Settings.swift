import Foundation

/// Connection settings, stored in UserDefaults. Personal-use app: the token is your own Kairos passcode.
enum AppSettings {
    static let urlKey = "serverURL"
    static let tokenKey = "token"
    static let pinKey = "pinToDesktop"

    static var serverURL: String {
        (UserDefaults.standard.string(forKey: urlKey) ?? "http://localhost:3000")
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .trimmingCharacters(in: CharacterSet(charactersIn: "/"))
    }
    static var token: String { UserDefaults.standard.string(forKey: tokenKey) ?? "" }
    static var pinToDesktop: Bool { UserDefaults.standard.bool(forKey: pinKey) }
    static var isConfigured: Bool { !token.isEmpty }
}

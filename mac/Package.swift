// swift-tools-version: 5.10
import PackageDescription

let package = Package(
    name: "Kairos",
    platforms: [.macOS(.v14)],
    targets: [
        .executableTarget(name: "Kairos", path: "Sources/Kairos")
    ]
)

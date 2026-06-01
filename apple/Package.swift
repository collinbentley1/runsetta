// swift-tools-version: 6.2

import PackageDescription

let package = Package(
    name: "RunsettaApple",
    platforms: [
        .iOS(.v26),
        .watchOS(.v26),
        .macOS(.v26),
    ],
    products: [
        .library(name: "RunsettaCore", targets: ["RunsettaCore"]),
        .executable(name: "RunsettaCoreCheck", targets: ["RunsettaCoreCheck"]),
    ],
    targets: [
        .target(name: "RunsettaCore"),
        .executableTarget(name: "RunsettaCoreCheck", dependencies: ["RunsettaCore"]),
    ]
)

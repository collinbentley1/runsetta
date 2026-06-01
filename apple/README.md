# Runsetta Apple

The Apple client is split into a tested Swift package and platform app entry points:

- `RunsettaCore` contains the API contract, client, and observable model shared by iOS and watchOS.
- `Apps/iOS` contains the SwiftUI iOS app shell.
- `Apps/watchOS` contains the SwiftUI watchOS companion shell.

The app source targets iOS 26 and watchOS 26. It uses standard SwiftUI navigation and controls first, then applies Liquid Glass only to the primary custom coaching panel.

#if os(iOS)
import RunsettaCore
import SwiftUI

@main
struct RunsettaApp: App {
    @StateObject private var coachModel = RunsettaCoachModel()

    var body: some Scene {
        WindowGroup {
            RunsettaHomeView()
                .environmentObject(coachModel)
                .task {
                    await coachModel.refreshHealth()
                }
        }
    }
}

struct RunsettaHomeView: View {
    @EnvironmentObject private var coachModel: RunsettaCoachModel
    @State private var cue = ""

    var body: some View {
        NavigationSplitView {
            List {
                NavigationLink("Coach", systemImage: "figure.run") {
                    CoachPanel(cue: $cue)
                }
                NavigationLink("Now Playing", systemImage: "music.note") {
                    TrackPanel()
                }
            }
            .navigationTitle("Runsetta")
        } detail: {
            CoachPanel(cue: $cue)
        }
    }
}

struct CoachPanel: View {
    @EnvironmentObject private var coachModel: RunsettaCoachModel
    @Binding var cue: String

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                VStack(alignment: .leading, spacing: 10) {
                    Text("Coach")
                        .font(.largeTitle.weight(.semibold))
                    Text(coachModel.message?.message ?? "Start with a simple cue, then let Runsetta shape it for the run.")
                        .font(.title2)
                        .foregroundStyle(.secondary)
                }

                TextField("Cue", text: $cue)
                    .textFieldStyle(.roundedBorder)

                Button {
                    Task {
                        await coachModel.requestCoachCue(cue: cue.isEmpty ? nil : cue)
                    }
                } label: {
                    Label(coachModel.isLoading ? "Generating" : "Generate", systemImage: "sparkles")
                }
                .buttonStyle(.borderedProminent)
                .disabled(coachModel.isLoading)

                if let health = coachModel.health {
                    Label(health.openaiConfigured ? "OpenAI ready" : "Fallback mode", systemImage: "server.rack")
                        .foregroundStyle(.secondary)
                }
            }
            .padding(24)
            .runsettaGlassPanel()
            .padding()
        }
        .navigationTitle("Coach")
    }
}

struct TrackPanel: View {
    @EnvironmentObject private var coachModel: RunsettaCoachModel
    @State private var title = ""
    @State private var artist = ""

    var body: some View {
        Form {
            TextField("Track", text: $title)
            TextField("Artist", text: $artist)
            Button {
                Task {
                    await coachModel.requestTransition(for: Track(title: title, artist: artist.isEmpty ? nil : artist))
                }
            } label: {
                Label("Write Transition", systemImage: "forward.end")
            }
        }
        .navigationTitle("Now Playing")
    }
}

private extension View {
    @ViewBuilder
    func runsettaGlassPanel() -> some View {
        if #available(iOS 26.0, *) {
            self.glassEffect(.regular.interactive(), in: .rect(cornerRadius: 28))
        } else {
            self.background(.regularMaterial, in: RoundedRectangle(cornerRadius: 28))
        }
    }
}
#endif

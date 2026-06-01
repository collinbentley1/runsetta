#if os(watchOS)
import RunsettaCore
import SwiftUI

@main
struct RunsettaWatchApp: App {
    @StateObject private var coachModel = RunsettaCoachModel()

    var body: some Scene {
        WindowGroup {
            WatchCoachView()
                .environmentObject(coachModel)
        }
    }
}

struct WatchCoachView: View {
    @EnvironmentObject private var coachModel: RunsettaCoachModel

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Runsetta")
                .font(.headline)

            Text(coachModel.message?.message ?? "Ready for the next cue.")
                .font(.title3)
                .minimumScaleFactor(0.72)

            Button {
                Task {
                    await coachModel.requestCoachCue()
                }
            } label: {
                Label("Cue", systemImage: "figure.run")
            }
            .buttonStyle(.borderedProminent)
        }
        .padding()
        .runsettaWatchGlass()
    }
}

private extension View {
    @ViewBuilder
    func runsettaWatchGlass() -> some View {
        if #available(watchOS 26.0, *) {
            self.glassEffect(.regular.interactive(), in: .rect(cornerRadius: 18))
        } else {
            self.background(.regularMaterial, in: RoundedRectangle(cornerRadius: 18))
        }
    }
}
#endif

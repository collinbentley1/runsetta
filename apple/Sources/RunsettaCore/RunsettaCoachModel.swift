import Foundation

@MainActor
public final class RunsettaCoachModel: ObservableObject {
    @Published public private(set) var context: RunContext
    @Published public private(set) var message: GeneratedMessage?
    @Published public private(set) var health: HealthStatus?
    @Published public private(set) var isLoading = false
    @Published public private(set) var errorMessage: String?

    private let client: RunsettaAPIClient

    public init(context: RunContext = RunContext(), client: RunsettaAPIClient = RunsettaAPIClient()) {
        self.context = context
        self.client = client
    }

    public func updateContext(_ context: RunContext) {
        self.context = context
    }

    public func refreshHealth() async {
        do {
            health = try await client.health()
        } catch {
            errorMessage = "Runsetta API is unreachable."
        }
    }

    public func requestCoachCue(cue: String? = nil) async {
        await runRequest {
            message = try await client.coachMessage(CoachMessageRequest(context: context, cue: cue))
        }
    }

    public func requestTransition(for track: Track) async {
        await runRequest {
            message = try await client.spotifyTransition(SpotifyTransitionRequest(context: context, track: track))
        }
    }

    private func runRequest(_ operation: () async throws -> Void) async {
        isLoading = true
        errorMessage = nil

        do {
            try await operation()
        } catch {
            errorMessage = "Runsetta could not generate a cue."
        }

        isLoading = false
    }
}

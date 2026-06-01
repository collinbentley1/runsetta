import Foundation

public enum WorkoutType: String, Codable, CaseIterable, Sendable {
    case run
    case walk
    case ride
    case strength
    case mobility
}

public enum EffortLevel: String, Codable, CaseIterable, Sendable {
    case easy
    case steady
    case hard
    case race
}

public struct RunContext: Codable, Equatable, Sendable {
    public var runnerName: String?
    public var workoutType: WorkoutType
    public var effort: EffortLevel?
    public var distanceMeters: Double?
    public var elapsedSeconds: Double?
    public var paceSecondsPerKilometer: Double?
    public var heartRateBpm: Int?

    public init(
        runnerName: String? = nil,
        workoutType: WorkoutType = .run,
        effort: EffortLevel? = nil,
        distanceMeters: Double? = nil,
        elapsedSeconds: Double? = nil,
        paceSecondsPerKilometer: Double? = nil,
        heartRateBpm: Int? = nil
    ) {
        self.runnerName = runnerName
        self.workoutType = workoutType
        self.effort = effort
        self.distanceMeters = distanceMeters
        self.elapsedSeconds = elapsedSeconds
        self.paceSecondsPerKilometer = paceSecondsPerKilometer
        self.heartRateBpm = heartRateBpm
    }
}

public struct CoachMessageRequest: Codable, Equatable, Sendable {
    public var runnerName: String?
    public var workoutType: WorkoutType
    public var effort: EffortLevel?
    public var distanceMeters: Double?
    public var elapsedSeconds: Double?
    public var paceSecondsPerKilometer: Double?
    public var heartRateBpm: Int?
    public var cue: String?

    public init(context: RunContext, cue: String? = nil) {
        runnerName = context.runnerName
        workoutType = context.workoutType
        effort = context.effort
        distanceMeters = context.distanceMeters
        elapsedSeconds = context.elapsedSeconds
        paceSecondsPerKilometer = context.paceSecondsPerKilometer
        heartRateBpm = context.heartRateBpm
        self.cue = cue
    }
}

public struct Track: Codable, Equatable, Sendable {
    public var title: String
    public var artist: String?
    public var album: String?

    public init(title: String, artist: String? = nil, album: String? = nil) {
        self.title = title
        self.artist = artist
        self.album = album
    }
}

public struct SpotifyTransitionRequest: Codable, Equatable, Sendable {
    public var runnerName: String?
    public var workoutType: WorkoutType
    public var effort: EffortLevel?
    public var distanceMeters: Double?
    public var elapsedSeconds: Double?
    public var paceSecondsPerKilometer: Double?
    public var heartRateBpm: Int?
    public var track: Track

    public init(context: RunContext, track: Track) {
        runnerName = context.runnerName
        workoutType = context.workoutType
        effort = context.effort
        distanceMeters = context.distanceMeters
        elapsedSeconds = context.elapsedSeconds
        paceSecondsPerKilometer = context.paceSecondsPerKilometer
        heartRateBpm = context.heartRateBpm
        self.track = track
    }
}

public struct AudioRequest: Codable, Equatable, Sendable {
    public var message: String
    public var format: String
    public var voice: String?

    public init(message: String, format: String = "aac", voice: String? = nil) {
        self.message = message
        self.format = format
        self.voice = voice
    }
}

public struct GeneratedMessage: Codable, Equatable, Sendable {
    public var message: String
    public var generatedBy: String
    public var model: String?
}

public struct HealthStatus: Codable, Equatable, Sendable {
    public var ok: Bool
    public var service: String
    public var environment: String
    public var openaiConfigured: Bool
    public var spotifyConfigured: Bool
}

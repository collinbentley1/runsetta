import Foundation
import RunsettaCore

let request = CoachMessageRequest(
    context: RunContext(
        runnerName: "Collin",
        workoutType: .run,
        effort: .hard,
        distanceMeters: 5_000,
        elapsedSeconds: 1_480,
        paceSecondsPerKilometer: 296,
        heartRateBpm: 162
    ),
    cue: "hill finish"
)

let data = try JSONEncoder().encode(request)
let object = try require(JSONSerialization.jsonObject(with: data) as? [String: Any])

try check(object["runnerName"] as? String == "Collin", "runnerName did not encode")
try check(object["workoutType"] as? String == "run", "workoutType did not encode")
try check(object["effort"] as? String == "hard", "effort did not encode")
try check(object["cue"] as? String == "hill finish", "cue did not encode")

let transition = SpotifyTransitionRequest(
    context: RunContext(workoutType: .run, effort: .steady),
    track: Track(title: "Life", artist: "Jamie xx", album: "In Waves")
)
let transitionData = try JSONEncoder().encode(transition)
let decoded = try JSONDecoder().decode(SpotifyTransitionRequest.self, from: transitionData)

try check(decoded.track.title == "Life", "track title did not round trip")
try check(decoded.track.artist == "Jamie xx", "track artist did not round trip")
try check(decoded.track.album == "In Waves", "track album did not round trip")

func require<T>(_ value: T?) throws -> T {
    guard let value else {
        throw CheckError.failed("required value was nil")
    }

    return value
}

func check(_ condition: Bool, _ message: String) throws {
    guard condition else {
        throw CheckError.failed(message)
    }
}

enum CheckError: Error {
    case failed(String)
}

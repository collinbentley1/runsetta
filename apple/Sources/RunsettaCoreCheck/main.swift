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

// MARK: - Bearer token support for the paid API routes
//
// The server gate in src/server.ts requires `Authorization: Bearer ...` on the
// paid routes once the matching integration is configured, and answers 401
// otherwise. These checks pin the client contract that satisfies it.

// The authenticated set mirrors authorizePaidRoute exactly.
for path in ["/api/audio", "/api/coach", "/api/spotify-transition",
             "/api/spotify/token", "/api/spotify/refresh"] {
    try check(RunsettaAPIClient.requiresAuthorization(path), "\(path) must be an authenticated route")
}

// The token is never sent where the server does not ask for it.
for path in ["/livez", "/api/health"] {
    try check(!RunsettaAPIClient.requiresAuthorization(path), "\(path) must not carry the bearer token")
}

// A bearer only goes on the wire over TLS, or to loopback where there is no
// network to observe.
try check(RunsettaAPIClient.allowsBearer(over: try require(URL(string: "https://runsetta.com"))),
          "https must permit the bearer")
try check(RunsettaAPIClient.allowsBearer(over: try require(URL(string: "http://127.0.0.1:8080"))),
          "loopback must permit the bearer")
try check(RunsettaAPIClient.allowsBearer(over: try require(URL(string: "http://localhost:8080"))),
          "localhost must permit the bearer")
try check(!RunsettaAPIClient.allowsBearer(over: try require(URL(string: "http://runsetta.com"))),
          "plaintext to a remote host must refuse the bearer")

// The whole 127.0.0.0/8 range is loopback, not just 127.0.0.1.
for host in ["127.0.0.1", "127.0.0.2", "127.1.2.3", "127.255.255.254"] {
    try check(RunsettaAPIClient.allowsBearer(over: try require(URL(string: "http://\(host):8080"))),
              "\(host) is loopback and must permit the bearer")
}

// A name that merely looks like an address resolves off-host and must not be
// treated as loopback.
for host in ["127.0.0.1.example.com", "128.0.0.1", "12.7.0.1", "0.0.0.0", "1270.0.0.1", "127.0.0",
             "127.999.0.1", "127.256.0.1", "127.0.0.-1", "127..0.1",
             "127.+1.0.1", "127.0x1.0.1"] {
    try check(!RunsettaAPIClient.allowsBearer(over: try require(URL(string: "http://\(host):8080"))),
              "\(host) must not be treated as loopback")
}

// Fails closed before any network access rather than transmitting the
// credential in plaintext.
let insecure = RunsettaAPIClient(
    baseURL: try require(URL(string: "http://runsetta.com")),
    bearerToken: "test-token-not-a-real-credential"
)
do {
    _ = try await insecure.coachMessage(
        CoachMessageRequest(context: RunContext(workoutType: .run, effort: .steady), cue: "x")
    )
    throw CheckError.failed("an authenticated call over plaintext must refuse")
} catch RunsettaAPIError.insecureTokenTransport {
    // expected: refused before reaching the network
}

// Absent a token the client stays unauthenticated, which is correct when the
// server has no paid integration configured and its gate is inert.
try check(RunsettaAPIClient(baseURL: try require(URL(string: "https://runsetta.com"))).bearerToken == nil,
          "the default client must carry no token")

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

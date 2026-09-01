import Foundation

public struct RunsettaAPIClient: Sendable {
    public var baseURL: URL
    /// Bearer token for the paid API routes. `nil` leaves every request
    /// unauthenticated, which is correct when the server has no paid
    /// integration configured -- its gate is inert in that case.
    public var bearerToken: String?
    public var session: URLSession
    public var decoder: JSONDecoder
    public var encoder: JSONEncoder

    public init(
        baseURL: URL = URL(string: "http://127.0.0.1:8080")!,
        bearerToken: String? = nil,
        session: URLSession = .shared,
        decoder: JSONDecoder = JSONDecoder(),
        encoder: JSONEncoder = JSONEncoder()
    ) {
        self.baseURL = baseURL
        self.bearerToken = bearerToken
        self.session = session
        self.decoder = decoder
        self.encoder = encoder
    }

    /// Routes whose server-side gate requires `Authorization: Bearer ...` once
    /// the matching integration is configured. Mirrors `authorizePaidRoute` in
    /// src/server.ts. `/livez` and `/api/health` are deliberately absent: the
    /// token is never sent where the server does not ask for it.
    public static let authenticatedPaths: Set<String> = [
        "/api/audio",
        "/api/coach",
        "/api/spotify-transition",
        "/api/spotify/token",
        "/api/spotify/refresh",
    ]

    public static func requiresAuthorization(_ path: String) -> Bool {
        authenticatedPaths.contains(path)
    }

    /// A bearer token is only ever put on the wire over TLS, or to loopback
    /// where there is no network to observe. Anything else fails closed rather
    /// than transmitting the credential in plaintext.
    public static func allowsBearer(over url: URL) -> Bool {
        if url.scheme?.lowercased() == "https" { return true }
        guard let host = url.host()?.lowercased() else { return false }
        if host == "localhost" || host == "::1" || host == "[::1]" { return true }
        return isIPv4Loopback(host)
    }

    /// True only for a literal address in 127.0.0.0/8, the whole IPv4 loopback
    /// range. The parse is strict on purpose: a name that merely looks like an
    /// address, such as `127.0.0.1.example.com`, must not be treated as
    /// loopback, because it resolves off-host and would put the bearer on the
    /// wire in plaintext.
    static func isIPv4Loopback(_ host: String) -> Bool {
        let parts = host.split(separator: ".", omittingEmptySubsequences: false)
        guard parts.count == 4 else { return false }
        var octets: [Int] = []
        for part in parts {
            guard !part.isEmpty, part.count <= 3, part.allSatisfy(\.isNumber),
                  let value = Int(part), (0...255).contains(value) else { return false }
            octets.append(value)
        }
        return octets[0] == 127
    }

    public func health() async throws -> HealthStatus {
        try await get("/livez")
    }

    public func coachMessage(_ request: CoachMessageRequest) async throws -> GeneratedMessage {
        try await post("/api/coach", body: request)
    }

    public func spotifyTransition(_ request: SpotifyTransitionRequest) async throws -> GeneratedMessage {
        try await post("/api/spotify-transition", body: request)
    }

    public func speech(_ request: AudioRequest) async throws -> Data {
        var urlRequest = try requestFor("/api/audio")
        urlRequest.httpMethod = "POST"
        urlRequest.setValue("application/json", forHTTPHeaderField: "content-type")
        urlRequest.httpBody = try encoder.encode(request)

        let (data, response) = try await session.data(for: urlRequest)
        try validate(response: response, data: data)
        return data
    }

    private func get<Response: Decodable>(_ path: String) async throws -> Response {
        let (data, response) = try await session.data(for: try requestFor(path))
        try validate(response: response, data: data)
        return try decoder.decode(Response.self, from: data)
    }

    private func post<Body: Encodable, Response: Decodable>(_ path: String, body: Body) async throws -> Response {
        var request = try requestFor(path)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "content-type")
        request.httpBody = try encoder.encode(body)

        let (data, response) = try await session.data(for: request)
        try validate(response: response, data: data)
        return try decoder.decode(Response.self, from: data)
    }

    private func requestFor(_ path: String) throws -> URLRequest {
        var request = URLRequest(url: baseURL.appending(path: path))
        guard let bearerToken, Self.requiresAuthorization(path) else {
            return request
        }

        guard Self.allowsBearer(over: baseURL) else {
            throw RunsettaAPIError.insecureTokenTransport
        }

        request.setValue("Bearer \(bearerToken)", forHTTPHeaderField: "Authorization")
        return request
    }

    private func validate(response: URLResponse, data: Data) throws {
        guard let httpResponse = response as? HTTPURLResponse else {
            throw RunsettaAPIError.invalidResponse
        }

        guard (200..<300).contains(httpResponse.statusCode) else {
            let apiError = try? decoder.decode(RunsettaErrorResponse.self, from: data)
            throw RunsettaAPIError.http(statusCode: httpResponse.statusCode, message: apiError?.error)
        }
    }
}

public enum RunsettaAPIError: Error, Equatable, Sendable {
    case invalidResponse
    case http(statusCode: Int, message: String?)
    /// A bearer token was configured but the base URL is neither HTTPS nor
    /// loopback, so the request was refused instead of leaking the credential.
    case insecureTokenTransport
}

private struct RunsettaErrorResponse: Decodable {
    var error: String
}

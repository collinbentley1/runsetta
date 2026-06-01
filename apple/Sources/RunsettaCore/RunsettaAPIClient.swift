import Foundation

public struct RunsettaAPIClient: Sendable {
    public var baseURL: URL
    public var session: URLSession
    public var decoder: JSONDecoder
    public var encoder: JSONEncoder

    public init(
        baseURL: URL = URL(string: "http://127.0.0.1:8080")!,
        session: URLSession = .shared,
        decoder: JSONDecoder = JSONDecoder(),
        encoder: JSONEncoder = JSONEncoder()
    ) {
        self.baseURL = baseURL
        self.session = session
        self.decoder = decoder
        self.encoder = encoder
    }

    public func health() async throws -> HealthStatus {
        try await get("/healthz")
    }

    public func coachMessage(_ request: CoachMessageRequest) async throws -> GeneratedMessage {
        try await post("/api/coach", body: request)
    }

    public func spotifyTransition(_ request: SpotifyTransitionRequest) async throws -> GeneratedMessage {
        try await post("/api/spotify-transition", body: request)
    }

    public func speech(_ request: AudioRequest) async throws -> Data {
        var urlRequest = requestFor("/api/audio")
        urlRequest.httpMethod = "POST"
        urlRequest.setValue("application/json", forHTTPHeaderField: "content-type")
        urlRequest.httpBody = try encoder.encode(request)

        let (data, response) = try await session.data(for: urlRequest)
        try validate(response: response, data: data)
        return data
    }

    private func get<Response: Decodable>(_ path: String) async throws -> Response {
        let (data, response) = try await session.data(for: requestFor(path))
        try validate(response: response, data: data)
        return try decoder.decode(Response.self, from: data)
    }

    private func post<Body: Encodable, Response: Decodable>(_ path: String, body: Body) async throws -> Response {
        var request = requestFor(path)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "content-type")
        request.httpBody = try encoder.encode(body)

        let (data, response) = try await session.data(for: request)
        try validate(response: response, data: data)
        return try decoder.decode(Response.self, from: data)
    }

    private func requestFor(_ path: String) -> URLRequest {
        URLRequest(url: baseURL.appending(path: path))
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
}

private struct RunsettaErrorResponse: Decodable {
    var error: String
}

//
//  OpenAIService.swift
//  MirroringWorkoutsSample
//
//  Created by Collin Bentley on 1/26/24.
//  Copyright © 2024 Apple. All rights reserved.
//

import Foundation
import AVFoundation

enum HTTPMethod: String {
    case post = "POST"
    case get = "GET"
}

class OpenAIService {
    
    static let shared = OpenAIService()
    
    private init() { }

    private func generateAudioURLRequest(httpMethod: HTTPMethod, message: String) throws -> URLRequest {
        guard let url = URL(string: "https://hypercoach-gai.cdbentley.com/audio") else {
            throw URLError(.badURL)
        }

        print("Generating audio URL request.")
        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = httpMethod.rawValue

        let payload = ["input_text": message]
        let jsonData = try JSONEncoder().encode(payload)
        urlRequest.httpBody = jsonData
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")

        return urlRequest
    }

    func streamAudio(message: String) async throws -> URL {
        do {
            let urlRequest = try generateAudioURLRequest(httpMethod: .post, message: message)
            print("Making API call to stream audio.")
            let (data, _) = try await URLSession.shared.data(for: urlRequest)
            print("Received audio data, writing to file.")
            return try writeDataToTemporaryFile(data)
        } catch {
            print("Error in streaming audio: \(error)")
            throw error
        }
    }
    
    enum Endpoint {
        case coachBennett
        case spotifyTransition

        var url: String {
            switch self {
            case .coachBennett:
                return "https://hypercoach-gai.cdbentley.com/coach-bennett/batch"
            case .spotifyTransition:
                return "https://hypercoach-gai.cdbentley.com/spotify-transition/batch"
            }
        }
    }

    private func generateURLRequest(httpMethod: HTTPMethod, message: String, for endpoint: Endpoint) throws -> URLRequest {
        guard let url = URL(string: endpoint.url) else {
            throw URLError(.badURL)
        }
        
        var urlRequest = URLRequest(url: url)
        
        // Method
        urlRequest.httpMethod = httpMethod.rawValue
        
        // Body
        let userMessage = LangServeMessage(text: message)
        
        // Formulate request
        let payload = LangServePayload(inputs: [userMessage])
        let jsonData = try JSONEncoder().encode(payload)

        urlRequest.httpBody = jsonData
        
        return urlRequest
    }


    private func writeDataToTemporaryFile(_ data: Data) throws -> URL {
        let temporaryURL = FileManager.default.temporaryDirectory.appendingPathComponent("audio.aac")
        try data.write(to: temporaryURL)
        print("Audio data written to \(temporaryURL.path)")
        return temporaryURL
    }
     
    func makeAPICall(message: String, endpoint: Endpoint) async throws -> String {
        let urlRequest = try generateURLRequest(httpMethod: .post, message: message, for: endpoint)
        let (data, _) = try await URLSession.shared.data(for: urlRequest)
        let result = try JSONDecoder().decode(GPTResponse.self, from: data)

        print(result.output[0].content)
        return result.output[0].content
    }

}

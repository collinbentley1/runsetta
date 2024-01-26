//
//  OpenAIService.swift
//  MirroringWorkoutsSample
//
//  Created by Collin Bentley on 1/26/24.
//  Copyright © 2024 Apple. All rights reserved.
//

import Foundation

enum HTTPMethod: String {
    case post = "POST"
    case get = "GET"
}
class OpenAIService {
    
    static let shared = OpenAIService()
    
    private init () { }
    
    private func generateURLRequest(httpMethod: HTTPMethod, message: String) throws -> URLRequest {
        guard let url = URL(string: "https://hypercoach-gai.cdbentley.com/coach-bennett/batch") else {
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
     
    func makeAPICall(message: String) async throws {
        let urlRequest = try generateURLRequest(httpMethod: .post, message: message)
        
        let (data, _) = try await URLSession.shared.data(for: urlRequest)
        
        let result = try JSONDecoder().decode(GPTResponse.self, from: data)
//        print(result)
        print(result.output[0].content)
//        print(String(data: data, encoding: .utf8)!)
    }
}

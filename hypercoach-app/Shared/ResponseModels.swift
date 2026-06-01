//
//  ResponseModels.swift
//  MirroringWorkoutsSample
//
//  Created by Collin Bentley on 1/26/24.
//  Copyright © 2024 Apple. All rights reserved.
//

import Foundation

struct GPTResponse: Decodable {
    let output: [GPTCompletion]
}

struct GPTCompletion: Decodable {
    let content: String
}

//
//  RequestModels.swift
//  MirroringWorkoutsSample
//
//  Created by Collin Bentley on 1/26/24.
//  Copyright © 2024 Apple. All rights reserved.
//

import Foundation

struct LangServePayload: Encodable {
    let inputs: [LangServeMessage]
//    let config: String
//    let kwargs: String
}

struct LangServeMessage: Encodable {
    let text: String
}

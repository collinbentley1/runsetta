//
//  ViewControllerWrapper.swift
//  MirroringWorkoutsSample
//
//  Created by Collin Bentley on 1/27/24.
//  Copyright © 2024 Apple. All rights reserved.
//

import SwiftUI

struct ViewControllerWrapper: UIViewControllerRepresentable {
    typealias UIViewControllerType = ViewController

    func makeUIViewController(context: Context) -> ViewController {
        return ViewController()
    }

    func updateUIViewController(_ uiViewController: ViewController, context: Context) {
        // Update the view controller if needed.
    }
}

/*
See the LICENSE.txt file for this sample’s licensing information.

Abstract:
The SwiftUI app for iOS.
*/

import SwiftUI

@main
struct MirroringWorkoutsSampleApp: App {
    #if !targetEnvironment(simulator)
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    #endif
    private let workoutManager = WorkoutManager.shared

    var body: some Scene {
        WindowGroup {
            if UIDevice.current.userInterfaceIdiom == .phone {
                StartView()
                    .environmentObject(workoutManager)
            } else {
                WorkoutListView()
            }
        }
    }
}

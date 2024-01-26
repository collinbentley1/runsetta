/*
See the LICENSE.txt file for this sample’s licensing information.

Abstract:
A SwiftUI view that shows the workout summary.
*/



import SwiftUI
import HealthKit

struct MockWorkout {
    var totalTime: TimeInterval  // Duration in seconds
    var totalDistance: Double    // Distance in miles
    var totalEnergyBurned: Double  // Energy in calories
    var averageSpeed: Double      // Speed in mph
    var averageCadence: Double    // Cadence in RPM
    var averagePower: Double      // Power in Watts
}

extension MockWorkout {
    static var sample: MockWorkout {
        return MockWorkout(
            totalTime: 3600,  // 1 hour
            totalDistance: 9.32,  // 15 km in miles
            totalEnergyBurned: 500,  // 500 cal
            averageSpeed: 11.18,  // 5 m/s in mph
            averageCadence: 80,  // 80 RPM
            averagePower: 250  // 250 Watts
        )
    }
}

struct SummaryView: View {
    @Binding var workout: HKWorkout?
    var mockWorkout: MockWorkout?

    init(workout: Binding<HKWorkout?> = .constant(nil), mockWorkout: MockWorkout? = nil) {
        self._workout = workout
        self.mockWorkout = mockWorkout
    }

    var body: some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 150))]) {
            if let workout = workout {
                GridItemView(title: "Total Time", value: workout.totalTime)
                    .foregroundStyle(.yellow)
                
                GridItemView(title: "Total Distance", value: workout.totalCyclingDistance)
                    .foregroundStyle(.orange)
                
                GridItemView(title: "Total Energy", value: workout.totalEnergy)
                    .foregroundStyle(.pink)
                
                GridItemView(title: "Average Speed", value: workout.averageCyclingSpeed)
                    .foregroundStyle(.green)
                
                GridItemView(title: "Average Power", value: workout.averageCyclingPower)
                    .foregroundStyle(.pink)
                
                GridItemView(title: "Average Cadence", value: workout.averageCyclingCadence)
                    .foregroundStyle(.black)
            } else if let mockWorkout = mockWorkout {
                // Use mock workout data for preview

                GridItemView(title: "Total Time", value: formatTimeInterval(mockWorkout.totalTime))
                GridItemView(title: "Total Distance", value: "\(mockWorkout.totalDistance) mi")
                GridItemView(title: "Total Energy", value: "\(mockWorkout.totalEnergyBurned) cal")
                GridItemView(title: "Average Speed", value: "\(mockWorkout.averageSpeed) mph")
                GridItemView(title: "Average Power", value: "\(mockWorkout.averagePower) W")
                GridItemView(title: "Average Cadence", value: "\(mockWorkout.averageCadence) RPM")
            } else {
                Text("No workout data available")
            }
        }
        .task {
            do {
                try await OpenAIService.shared.makeAPICall(message: "I'm making progress but my arm is sore.")
            } catch {
                print(error.localizedDescription)
            }
        }
    }

    private func formatTimeInterval(_ timeInterval: TimeInterval) -> String {
        let hours = Int(timeInterval) / 3600
        let minutes = Int(timeInterval) % 3600 / 60

        var formattedString = ""
        if hours > 0 {
            formattedString += "\(hours)h "
        }
        if minutes > 0 || hours > 0 {
            formattedString += "\(minutes)m"
        }
        return formattedString.trimmingCharacters(in: .whitespaces)
    }

}

private struct GridItemView: View {
    var title: String
    var value: String

    var body: some View {
        VStack {
            Text(title)
                .font(.headline)
                .foregroundColor(.secondary)
            Text(value)
                .font(.system(size: 20, weight: .bold, design: .rounded))
                .foregroundColor(.primary)
        }
        .padding()
        .frame(minWidth: 0, maxWidth: .infinity)
        .background(Color.gray.opacity(0.1))
        .cornerRadius(8)
    }
}

#Preview {
    SummaryView(mockWorkout: MockWorkout.sample)
}

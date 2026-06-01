//
//  CoachAudioView.swift
//  MirroringWorkoutsSample
//
//  Created by Collin Bentley on 1/26/24.
//  Copyright © 2024 Apple. All rights reserved.
//

import SwiftUI
import AVFoundation
import MediaPlayer

class CoachAudioViewModel: ObservableObject {
    static let shared = CoachAudioViewModel()
    @Published var currentTrackName: String = ""
    
    var player: AVPlayer?

    private init() {
        configureAudioSession()
        setupInterruptionNotification()
        setupRemoteTransportControls()
        setupAppLifecycleObservers()
    }
    
    private func setupAppLifecycleObservers() {
        NotificationCenter.default.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main) { [weak self] _ in
            self?.activateAudioSession()
        }

        NotificationCenter.default.addObserver(forName: UIApplication.didEnterBackgroundNotification, object: nil, queue: .main) { [weak self] _ in
            self?.deactivateAudioSession()
        }
    }

    func configureAudioSession() {
        do {
            try AVAudioSession.sharedInstance().setCategory(.ambient)
            try AVAudioSession.sharedInstance().setActive(true)
        } catch {
            print("Failed to configure and activate audio session:", error)
        }
    }

    func setupInterruptionNotification() {
        NotificationCenter.default.addObserver(forName: AVAudioSession.interruptionNotification, object: nil, queue: .main) { [weak self] notification in
            self?.handleAudioSessionInterruption(notification: notification)
        }
    }

    func handleAudioSessionInterruption(notification: Notification) {
        guard let userInfo = notification.userInfo,
              let typeValue = userInfo[AVAudioSessionInterruptionTypeKey] as? UInt,
              let type = AVAudioSession.InterruptionType(rawValue: typeValue) else {
                  return
        }

        if type == .began {
            player?.pause()
            print("Audio playback interrupted.")
        } else if type == .ended {
            if let optionsValue = userInfo[AVAudioSessionInterruptionOptionKey] as? UInt,
               AVAudioSession.InterruptionOptions(rawValue: optionsValue).contains(.shouldResume) {
                player?.play()
                print("Audio playback resumed after interruption.")
            }
        }
    }

    func setupRemoteTransportControls() {
        let commandCenter = MPRemoteCommandCenter.shared()
        commandCenter.playCommand.addTarget { [weak self] event in
            self?.player?.play()
            return .success
        }
        commandCenter.pauseCommand.addTarget { [weak self] event in
            self?.player?.pause()
            return .success
        }
    }

    func playStreamedAudio(message: String) {
        Task {
            do {
                let audioURL = try await OpenAIService.shared.streamAudio(message: message)
                let playerItem = AVPlayerItem(url: audioURL)

                DispatchQueue.main.async {
                    self.player = AVPlayer(playerItem: playerItem)

                    DispatchQueue.main.asyncAfter(deadline: .now()) { [weak self] in
                        guard let self = self else { return }
                        do {
                            try AVAudioSession.sharedInstance().setCategory(.playback, mode: .default, options: [.duckOthers])
                            try AVAudioSession.sharedInstance().setActive(true)
                            self.player?.play()
                            print("Audio started playing.")
                        } catch {
                            print("Error setting up AVAudioSession: \(error)")
                        }
                    }

                    NotificationCenter.default.addObserver(
                        forName: .AVPlayerItemDidPlayToEndTime,
                        object: playerItem,
                        queue: .main) { _ in
                            print("Audio stopped playing.")
                            DispatchQueue.main.asyncAfter(deadline: .now() + 1) {
                                self.deactivateAudioSession()
                            }
                        }
                }
            } catch {
                print("Error fetching audio stream: \(error)")
            }
        }
    }

    func activateAudioSession() {
        do {
            try AVAudioSession.sharedInstance().setActive(true)
        } catch {
            print("Failed to activate audio session:", error)
        }
    }

    func deactivateAudioSession() {
        DispatchQueue.main.asyncAfter(deadline: .now()) {
            do {
                try AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
            } catch {
                print("Failed to deactivate audio session:", error)
            }
        }
    }
    
    // Call this method when the Spotify player state changes
    #if !targetEnvironment(simulator)
    func updateCurrentTrack(playerState: SPTAppRemotePlayerState) {
        DispatchQueue.main.async {
            self.currentTrackName = playerState.track.name
        }
    }
    #endif
}

struct AudioContentView: View {
    @ObservedObject var coachAudioViewModel = CoachAudioViewModel.shared
    @State private var currentDistance: Double = 3.75
    @State private var totalGoalDistance: Double = 5.0
    @State private var targetPace: Double = 600 // Represented in seconds (5 minutes)
    @State private var currentSplitPace: Double = 500 // Also in seconds
    @State private var inputText: String = ""
    @State private var responseText: String = "" // State variable to store API response
    
    // Spotify state variables (to create custom lyric)
    @State private var spotifyInputText: String = "" // Data to send to LLM for Spotify song transition
    @State private var spotifyResponseText: String = "" // LLM response for Spotify song transition
    
    @State private var currentSong: String = "Get into It (Yuh)"
    @State private var currentSongArtist: String = "Doja Cat"
    @State private var currentSongPrimaryLyric: String = ""

    @State private var nextSong: String = "" // When time to next song < 60 secs, send primary lyrics
    @State private var nextSongArtist: String = "" // When time to next song < 60 secs, send primary lyrics
    @State private var nextSongPrimaryLyric: String = ""

    @State private var timeToNextSong: Double = 0 // Also in seconds
    
    // Play audio picker
    @State private var selectedTextType: TextType = .inputText

    enum TextType: String, CaseIterable, Identifiable {
        case inputText = "Input"
        case responseText = "Message"
        case spotifyResponseText = "Transition"

        var id: String { self.rawValue }
    }



    var body: some View {
        ScrollView {
            VStack {
                TextEditor(text: $inputText)
                    .frame(minHeight: 100) // Adjust the height as needed
                    .border(Color.gray, width: 1) // Optional border for clarity
                    .padding()

                // Current Distance Slider
                Group {
                    Text("Current Distance: \(String(format: "%.2f", currentDistance)) miles")
                    Slider(value: $currentDistance, in: 0...10, step: 0.25)
                }.padding()

                // Total Goal Distance Slider
                Group {
                    Text("Total Goal Distance: \(String(format: "%.2f", totalGoalDistance)) miles")
                    Slider(value: $totalGoalDistance, in: 0...10, step: 0.25)
                }.padding()

                // Target Pace Slider
                Group {
                    Text("Target Pace: \(formatPace(seconds: targetPace)) min/mile")
                    Slider(value: $targetPace, in: 300...720, step: 10) // 5 to 12 minutes
                }.padding()

                // Current Split Pace Slider
                Group {
                    Text("Current Split Pace: \(formatPace(seconds: currentSplitPace)) min/mile")
                    Slider(value: $currentSplitPace, in: 300...720, step: 10)
                }
                .padding()
                .onAppear {
                    updateInputText() // Populates the TextEditor when the view first loads
                }

                // Buttons
                HStack {

                    // Get Message Button
                    Button("Get Message") {
                        Task {
                            do {
                                responseText = try await OpenAIService.shared.makeAPICall(message: inputText, endpoint: .coachBennett)
                            } catch {
                                print("Error: \(error)")
                                responseText = "Error: \(error.localizedDescription)"
                            }
                        }
                    }
                    .padding()
                    .background(Color.green)
                    .foregroundColor(.white)
                    .cornerRadius(8)
                
                    // Get Transition Button
                    Button("Get Transition") {
                        Task {
                            do {
                                spotifyResponseText = try await OpenAIService.shared.makeAPICall(message: "Now Playing: \"\(currentSong)\" by \(currentSongArtist)", endpoint: .spotifyTransition)
                            } catch {
                                print("Error: \(error)")
                                spotifyResponseText = "Error: \(error.localizedDescription)"
                            }
                        }
                    }
                    .padding()
                    .background(Color.purple)
                    .foregroundColor(.white)
                    .cornerRadius(8)
                }
                
                HStack {
                    // Play Audio Picker
                    Picker("Select Text Type", selection: $selectedTextType) {
                        ForEach(TextType.allCases) { type in
                            Text(type.rawValue).tag(type)
                        }
                    }
                    .pickerStyle(SegmentedPickerStyle())
                    .padding()
                    
                    // Play Audio Button
                    Button("Play Audio") {
                        let textToPlay: String
                        switch selectedTextType {
                        case .inputText:
                            textToPlay = inputText
                        case .responseText:
                            textToPlay = responseText
                        case .spotifyResponseText:
                            textToPlay = spotifyResponseText
                        }
                        
                        coachAudioViewModel.playStreamedAudio(message: textToPlay)
                    }
                    .padding()
                    .background(Color.blue)
                    .foregroundColor(.white)
                    .cornerRadius(8)
                }

                // Display the response
                if !responseText.isEmpty {
                    Text(responseText)
                        .padding()
                        .border(Color.green, width: 1)
                }
                
                // Display the Spotify response
                if !spotifyResponseText.isEmpty {
                    Text(spotifyResponseText)
                        .padding()
                        .border(Color.purple, width: 1)
                }

                #if !targetEnvironment(simulator)
                // Display the current track name
//                Text("Now Playing: \(coachAudioViewModel.currentTrackName)")
                Text("Now Playing: \"\(currentSong)\" by \(currentSongArtist)")
                    .padding()
                #endif
            }
            .padding()
            .onChange(of: currentDistance) { _ in updateInputText() }
            .onChange(of: totalGoalDistance) { _ in updateInputText() }
            .onChange(of: targetPace) { _ in updateInputText() }
            .onChange(of: currentSplitPace) { _ in updateInputText() }
            .onChange(of: currentSong) { _ in updateSpotifyText() }
            .onChange(of: nextSong) { _ in updateSpotifyText() }
            .onChange(of: timeToNextSong) { _ in updateSpotifyText() }
            .onChange(of: currentSongPrimaryLyric) { _ in updateSpotifyText() }
            .onChange(of: nextSongPrimaryLyric) { _ in updateSpotifyText() }
            .onChange(of: currentSongArtist) { _ in updateSpotifyText() }

        }
    }

    private func updateInputText() {
        let targetPaceString = formatPace(seconds: targetPace)
        let currentSplitPaceString = formatPace(seconds: currentSplitPace)
        
        inputText = "My current distance is \(String(format: "%.2f", currentDistance)) miles, my total distance goal is \(String(format: "%.2f", totalGoalDistance)) miles, my current split pace is \(currentSplitPaceString) minutes, and my target pace is \(targetPaceString) minutes."
    }

    
    private func updateSpotifyText() {
        
        spotifyInputText = "\"\(currentSong)\" by \(currentSongArtist)"
    }
    
    private func formatPace(seconds: Double) -> String {
        let minutes = Int(seconds) / 60
        let secs = Int(seconds) % 60
        return "\(minutes):\(String(format: "%02d", secs))"
    }
}

// Preview for SwiftUI Canvas
#Preview {
    AudioContentView()
}

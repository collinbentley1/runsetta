//
//  AppDelegate.swift
//  iOS SDK Quick Start
//
//  Created by Spotify on 14/06/2018.
//  Copyright © 2018 Spotify for Developers. All rights reserved.
//

import UIKit

class AppDelegate: UIResponder, UIApplicationDelegate, SPTSessionManagerDelegate, SPTAppRemoteDelegate, SPTAppRemotePlayerStateDelegate {
    var window: UIWindow?
    
    let SpotifyClientID = "5208dbb58a1e4ec299b79df26234d38a"
    let SpotifyRedirectURL = URL(string: "hypercoach://spotify-login-callback")!
    
    lazy var configuration = SPTConfiguration(
        clientID: SpotifyClientID,
        redirectURL: SpotifyRedirectURL
    )
    
    lazy var sessionManager: SPTSessionManager = {
        if let tokenSwapURL = URL(string: "https://hypercoach-gai.cdbentley.com/api/token"),
           let tokenRefreshURL = URL(string: "https://hypercoach-gai.cdbentley.com/api/refresh_token") {
            self.configuration.tokenSwapURL = tokenSwapURL
            self.configuration.tokenRefreshURL = tokenRefreshURL
            self.configuration.playURI = ""
        }
        let manager = SPTSessionManager(configuration: self.configuration, delegate: self)
        return manager
    }()

    lazy var appRemote: SPTAppRemote = {
        let appRemote = SPTAppRemote(configuration: configuration, logLevel: .debug)
        appRemote.delegate = self
        return appRemote
    }()

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Override point for customization after application launch.

        let requestedScopes: SPTScope = [.appRemoteControl]
        print("Initiating Spotify session with requested scopes.")
        self.sessionManager.initiateSession(with: requestedScopes, options: .default)

        return true
    }

    
    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey : Any] = [:]) -> Bool {
        print("Open URL called with URL: \(url)")
        self.sessionManager.application(app, open: url, options: options)
        
        return true
    }
    
    func sessionManager(manager: SPTSessionManager, didInitiate session: SPTSession) {
        print("Spotify session initiated successfully. Access token acquired.")
        self.appRemote.connectionParameters.accessToken = session.accessToken
        self.appRemote.connect()
    }
    
    func sessionManager(manager: SPTSessionManager, didFailWith error: Error) {
        print("Spotify session initiation failed with error: \(error)")
    }
    
    func sessionManager(manager: SPTSessionManager, didRenew session: SPTSession) {
        print("Spotify session renewed. New session: \(session)")
    }
    
    func appRemoteDidEstablishConnection(_ appRemote: SPTAppRemote) {
        print("Successfully established connection with Spotify app remote.")

        self.appRemote.playerAPI?.delegate = self
        self.appRemote.playerAPI?.subscribe(toPlayerState: { (result, error) in
            if let error = error {
                debugPrint(error.localizedDescription)
            }
        })
        
       // Want to play a new track?
        self.appRemote.playerAPI?.play("spotify:track:13WO20hoD72L0J13WTQWlT", callback: { (result, error) in
            if let error = error {
                print(error.localizedDescription)
            }
        })
    }
    
    func appRemote(_ appRemote: SPTAppRemote, didDisconnectWithError error: Error?) {
        if let error = error {
            print("Spotify app remote disconnected with error: \(error)")
        } else {
            print("Spotify app remote disconnected.")
        }
    }
    
    func appRemote(_ appRemote: SPTAppRemote, didFailConnectionAttemptWithError error: Error?) {
        if let error = error {
            print("Failed to connect Spotify app remote with error: \(error)")
        } else {
            print("Failed to connect Spotify app remote.")
        }
    }

    func playerStateDidChange(_ playerState: SPTAppRemotePlayerState) {
        print("Spotify player state changed.")
        print("isPaused", playerState.isPaused)
        print("track.uri", playerState.track.uri)
        print("track.name", playerState.track.name)
        print("track.imageIdentifier", playerState.track.imageIdentifier)
        print("track.artist.name", playerState.track.artist.name)
        print("track.album.name", playerState.track.album.name)
        print("track.isSaved", playerState.track.isSaved)
        print("playbackSpeed", playerState.playbackSpeed)
        print("playbackOptions.isShuffling", playerState.playbackOptions.isShuffling)
        print("playbackOptions.repeatMode", playerState.playbackOptions.repeatMode.hashValue)
        print("playbackPosition", playerState.playbackPosition)
        #if !targetEnvironment(simulator)
        CoachAudioViewModel.shared.updateCurrentTrack(playerState: playerState)
        #endif

    }
    
    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
        print("Application will resign active. Disconnecting Spotify app remote.")
        if self.appRemote.isConnected {
            self.appRemote.disconnect()
        }
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
        print("Application became active. Attempting to reconnect Spotify app remote.")
        if let _ = self.appRemote.connectionParameters.accessToken {
            self.appRemote.connect()
        }
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }
}

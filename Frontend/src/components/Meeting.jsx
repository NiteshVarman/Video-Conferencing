"use client"

import { useEffect, useRef, useState } from "react"
import { useParams } from "react-router-dom"
import io from "socket.io-client"
import "./Meeting.css"

const server_url = 'https://api.video-meet.tech';


const peerConfigConnections = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
}

export default function Meeting() {
  const { meetingId: urlMeetingId } = useParams()
  const socketRef = useRef(null)
  const socketIdRef = useRef(null)
  const localVideoref = useRef(null)
  const connectionsRef = useRef({})
  const videoRef = useRef([])
  const [videoAvailable, setVideoAvailable] = useState(true)
  const [audioAvailable, setAudioAvailable] = useState(true)
  const [video, setVideo] = useState(true)
  const [audio, setAudio] = useState(true)
  const [screen, setScreen] = useState(false)
  const [showModal, setModal] = useState(false)
  const [screenAvailable, setScreenAvailable] = useState(false)
  const [messages, setMessages] = useState([])
  const [message, setMessage] = useState("")
  const [newMessages, setNewMessages] = useState(0)
  const [askForUsername, setAskForUsername] = useState(true)
  const [username, setUsername] = useState("")
  const [videos, setVideos] = useState([])
  const [users, setUsers] = useState({})
  const [userVideoStates, setUserVideoStates] = useState({}) // Track video states of all users
  const [userAudioStates, setUserAudioStates] = useState({}) // Track audio states of all users
  const [meetingId, setMeetingId] = useState("")
  const [meetingLink, setMeetingLink] = useState("")
  const [usernameError, setUsernameError] = useState("")

  useEffect(() => {
    const link = document.createElement("link")
    link.rel = "stylesheet"
    link.href = "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
    document.head.appendChild(link)
    return () => document.head.removeChild(link)
  }, [])

  useEffect(() => {
    if (urlMeetingId) {
      setMeetingId(urlMeetingId)
      setMeetingLink(`${window.location.origin}/join/${urlMeetingId}`)
      console.log(`Meeting ID set to: ${urlMeetingId}`)
      getPermissions()
    }
  }, [urlMeetingId])

  const getPermissions = async () => {
    try {
      const videoPermission = await navigator.mediaDevices.getUserMedia({ video: true })
      setVideoAvailable(!!videoPermission)
      console.log("Video permission:", videoPermission ? "granted" : "denied")

      const audioPermission = await navigator.mediaDevices.getUserMedia({ audio: true })
      setAudioAvailable(!!audioPermission)
      console.log("Audio permission:", audioPermission ? "granted" : "denied")

      setScreenAvailable(!!navigator.mediaDevices.getDisplayMedia)

      if (videoAvailable || audioAvailable) {
        const userMediaStream = await navigator.mediaDevices.getUserMedia({
          video: videoAvailable,
          audio: audioAvailable,
        })

        if (userMediaStream) {
          window.localStream = userMediaStream
          if (localVideoref.current) {
            localVideoref.current.srcObject = userMediaStream
          }
        }
      }
    } catch (error) {
      console.error("Permission error:", error)
    }
  }

  const copyMeetingLink = () => {
    navigator.clipboard.writeText(meetingLink)
    alert("Meeting link copied to clipboard!")
  }

  useEffect(() => {
    if (video !== undefined && audio !== undefined && socketRef.current && socketIdRef.current) {
      getUserMedia()
      // Broadcast video/audio state changes to other users
      socketRef.current.emit("media-state-change", {
        meetingId,
        userId: socketIdRef.current,
        videoEnabled: video,
        audioEnabled: audio,
      })
      console.log(`Broadcasting media state: video=${video}, audio=${audio}`)
    }
  }, [video, audio])

  useEffect(() => {
    if (screen !== undefined) {
      getDisplayMedia()
    }
  }, [screen])

  const getUserMedia = async () => {
    if ((video && videoAvailable) || (audio && audioAvailable)) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: video, audio: audio })
        getUserMediaSuccess(stream)
      } catch (e) {
        console.error("getUserMedia error:", e)
      }
    } else {
      try {
        if (localVideoref.current && localVideoref.current.srcObject) {
          localVideoref.current.srcObject.getTracks().forEach((track) => track.stop())
        }
      } catch (e) {
        console.error("Error stopping tracks:", e)
      }
    }
  }

  const getUserMediaSuccess = (stream) => {
    try {
      if (window.localStream) {
        window.localStream.getTracks().forEach((track) => track.stop())
      }
    } catch (e) {
      console.error("Error stopping previous stream:", e)
    }

    window.localStream = stream
    if (localVideoref.current) {
      localVideoref.current.srcObject = stream
    }

    console.log("User media tracks:", {
      video: stream.getVideoTracks().length,
      audio: stream.getAudioTracks().length,
    })

    if (!socketIdRef.current) {
      console.error("Socket ID not initialized in getUserMediaSuccess")
      return
    }

    for (const id in connectionsRef.current) {
      if (id === socketIdRef.current) continue

      const videoTrack = stream.getVideoTracks()[0]
      const audioTrack = stream.getAudioTracks()[0]

      if (videoTrack) {
        connectionsRef.current[id].addTrack(videoTrack, stream)
        console.log(`Added video track for ${id}`)
      } else {
        console.warn(`No video track for ${id}`)
      }

      if (audioTrack) {
        connectionsRef.current[id].addTrack(audioTrack, stream)
        console.log(`Added audio track for ${id}`)
      } else {
        console.warn(`No audio track for ${id}`)
      }

      connectionsRef.current[id]
        .createOffer()
        .then((description) => {
          connectionsRef.current[id]
            .setLocalDescription(description)
            .then(() => {
              socketRef.current.emit("offer", {
                meetingId,
                offer: description,
                toId: id,
                fromId: socketIdRef.current,
              })
              console.log(`Offer sent from ${socketIdRef.current} to ${id}`)
            })
            .catch((e) => console.error("setLocalDescription error:", e))
        })
        .catch((e) => console.error("createOffer error:", e))
    }

    stream.getTracks().forEach((track) => {
      track.onended = () => {
        setVideo(false)
        setAudio(false)

        try {
          if (localVideoref.current && localVideoref.current.srcObject) {
            localVideoref.current.srcObject.getTracks().forEach((track) => track.stop())
          }
        } catch (e) {
          console.error("Error stopping tracks on end:", e)
        }

        const blackSilence = (...args) => new MediaStream([black(...args), silence()])
        window.localStream = blackSilence()
        if (localVideoref.current) {
          localVideoref.current.srcObject = window.localStream
        }

        if (!socketIdRef.current) {
          console.error("Socket ID not initialized in track.onended")
          return
        }

        for (const id in connectionsRef.current) {
          const videoTrack = window.localStream.getVideoTracks()[0]
          const audioTrack = window.localStream.getAudioTracks()[0]

          if (videoTrack) connectionsRef.current[id].addTrack(videoTrack, window.localStream)
          if (audioTrack) connectionsRef.current[id].addTrack(audioTrack, window.localStream)

          connectionsRef.current[id]
            .createOffer()
            .then((description) => {
              connectionsRef.current[id]
                .setLocalDescription(description)
                .then(() => {
                  socketRef.current.emit("offer", {
                    meetingId,
                    offer: description,
                    toId: id,
                    fromId: socketIdRef.current,
                  })
                  console.log(`Offer sent from ${socketIdRef.current} to ${id} (track ended)`)
                })
                .catch((e) => console.error("setLocalDescription error:", e))
            })
            .catch((e) => console.error("createOffer error:", e))
        }
      }
    })
  }

  const getDisplayMedia = async () => {
    if (screen && navigator.mediaDevices.getDisplayMedia) {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
        getDisplayMediaSuccess(stream)
      } catch (e) {
        console.error("getDisplayMedia error:", e)
      }
    }
  }

  const getDisplayMediaSuccess = (stream) => {
    try {
      if (window.localStream) {
        window.localStream.getTracks().forEach((track) => track.stop())
      }
    } catch (e) {
      console.error("Error stopping previous stream:", e)
    }

    window.localStream = stream
    if (localVideoref.current) {
      localVideoref.current.srcObject = stream
    }

    console.log("Display media tracks:", {
      video: stream.getVideoTracks().length,
      audio: stream.getAudioTracks().length,
    })

    if (!socketIdRef.current) {
      console.error("Socket ID not initialized in getDisplayMediaSuccess")
      return
    }

    for (const id in connectionsRef.current) {
      if (id === socketIdRef.current) continue

      const videoTrack = stream.getVideoTracks()[0]
      const audioTrack = stream.getAudioTracks()[0]

      if (videoTrack) {
        connectionsRef.current[id].addTrack(videoTrack, stream)
        console.log(`Added video track for ${id} (screen)`)
      } else {
        console.warn(`No video track for ${id} (screen)`)
      }

      if (audioTrack) {
        connectionsRef.current[id].addTrack(audioTrack, stream)
        console.log(`Added audio track for ${id} (screen)`)
      } else {
        console.warn(`No audio track for ${id} (screen)`)
      }

      connectionsRef.current[id]
        .createOffer()
        .then((description) => {
          connectionsRef.current[id]
            .setLocalDescription(description)
            .then(() => {
              socketRef.current.emit("offer", {
                meetingId,
                offer: description,
                toId: id,
                fromId: socketIdRef.current,
              })
              console.log(`Offer sent from ${socketIdRef.current} to ${id} (screen)`)
            })
            .catch((e) => console.error("setLocalDescription error:", e))
        })
        .catch((e) => console.error("createOffer error:", e))
    }

    stream.getTracks().forEach((track) => {
      track.onended = () => {
        setScreen(false)

        try {
          if (localVideoref.current && localVideoref.current.srcObject) {
            localVideoref.current.srcObject.getTracks().forEach((track) => track.stop())
          }
        } catch (e) {
          console.error("Error stopping tracks on end:", e)
        }

        const blackSilence = (...args) => new MediaStream([black(...args), silence()])
        window.localStream = blackSilence()
        if (localVideoref.current) {
          localVideoref.current.srcObject = window.localStream
        }

        getUserMedia()
      }
    })
  }

  const connectToSocketServer = () => {
    socketRef.current = io.connect(server_url, { secure: false })

    socketRef.current.on("connect", () => {
      socketIdRef.current = socketRef.current.id
      console.log(`Socket connected with ID: ${socketIdRef.current}`)

      socketRef.current.emit("join-meeting", {
        meetingId,
        userId: username,
        videoEnabled: video,
        audioEnabled: audio,
      })
      console.log(`Joined meeting ${meetingId} as ${username}`)
      setUsers((prev) => ({ ...prev, [socketIdRef.current]: username }))
      setUserVideoStates((prev) => ({ ...prev, [socketIdRef.current]: video }))
      setUserAudioStates((prev) => ({ ...prev, [socketIdRef.current]: audio }))
    })

    socketRef.current.on("error", ({ message }) => {
      console.error("Socket error:", message)
      alert(message)
    })

    // Listen for media state changes from other users
    socketRef.current.on("media-state-change", ({ userId, videoEnabled, audioEnabled }) => {
      console.log(`Media state change from ${userId}: video=${videoEnabled}, audio=${audioEnabled}`)
      setUserVideoStates((prev) => ({ ...prev, [userId]: videoEnabled }))
      setUserAudioStates((prev) => ({ ...prev, [userId]: audioEnabled }))
    })

    // Listen for initial media states when joining
    socketRef.current.on("user-media-states", ({ mediaStates }) => {
      console.log("Received initial media states:", mediaStates)
      setUserVideoStates((prev) => ({ ...prev, ...mediaStates.video }))
      setUserAudioStates((prev) => ({ ...prev, ...mediaStates.audio }))
    })

    socketRef.current.on("user-joined", ({ id, clients, userMap, mediaStates }) => {
      console.log(`User-joined: ID=${id}, Clients=${clients}, UserMap=`, userMap)

      setUsers((prev) => {
        const updatedUsers = { ...prev }
        Object.entries(userMap).forEach(([socketId, userId]) => {
          if (userId) updatedUsers[socketId] = userId
        })
        console.log("Updated users:", updatedUsers)
        return updatedUsers
      })

      // Update media states for all users
      if (mediaStates) {
        setUserVideoStates((prev) => ({ ...prev, ...mediaStates.video }))
        setUserAudioStates((prev) => ({ ...prev, ...mediaStates.audio }))
      }

      const uniqueClients = [...new Set([...clients, id])]
      uniqueClients.forEach((socketListId) => {
        if (socketListId === socketIdRef.current || connectionsRef.current[socketListId]) return

        connectionsRef.current[socketListId] = new RTCPeerConnection(peerConfigConnections)

        connectionsRef.current[socketListId].onicecandidate = (event) => {
          if (event.candidate && socketIdRef.current) {
            socketRef.current.emit("ice-candidate", {
              meetingId,
              candidate: event.candidate,
              toId: socketListId,
              fromId: socketIdRef.current,
            })
            console.log(`ICE candidate sent from ${socketIdRef.current} to ${socketListId}`)
          }
        }

        connectionsRef.current[socketListId].ontrack = (event) => {
          console.log(`Received track from ${socketListId}`, event.streams)
          const stream = event.streams[0]
          if (!stream) return

          const streamExists = videos.some((video) => video.socketId === socketListId && video.stream.id === stream.id)
          if (streamExists) {
            console.log(`Stream from ${socketListId} already exists, skipping`)
            return
          }

          setVideos((prevVideos) => {
            const videoExists = prevVideos.find((video) => video.socketId === socketListId)
            let updatedVideos
            if (videoExists) {
              updatedVideos = prevVideos.map((video) =>
                video.socketId === socketListId ? { ...video, stream } : video,
              )
            } else {
              updatedVideos = [
                ...prevVideos,
                {
                  socketId: socketListId,
                  stream,
                  autoplay: true,
                  playsinline: true,
                },
              ]
            }
            videoRef.current = updatedVideos
            console.log(
              "Updated videos:",
              updatedVideos.map((v) => v.socketId),
            )
            return updatedVideos
          })
        }

        if (window.localStream) {
          window.localStream.getTracks().forEach((track) => {
            connectionsRef.current[socketListId].addTrack(track, window.localStream)
            console.log(`Added track to ${socketListId}`)
          })
        } else {
          const blackSilence = (...args) => new MediaStream([black(...args), silence()])
          window.localStream = blackSilence()
          window.localStream.getTracks().forEach((track) => {
            connectionsRef.current[socketListId].addTrack(track, window.localStream)
          })
        }
      })
    })

    socketRef.current.on("offer", ({ offer, fromId }) => {
      if (fromId === socketIdRef.current || !socketIdRef.current) return
      console.log(`Received offer from ${fromId}`)
      if (!connectionsRef.current[fromId]) {
        console.warn(`No connection for ${fromId}, creating new`)
        connectionsRef.current[fromId] = new RTCPeerConnection(peerConfigConnections)
        connectionsRef.current[fromId].onicecandidate = (event) => {
          if (event.candidate) {
            socketRef.current.emit("ice-candidate", {
              meetingId,
              candidate: event.candidate,
              toId: fromId,
              fromId: socketIdRef.current,
            })
            console.log(`ICE candidate sent to ${fromId}`)
          }
        }
        connectionsRef.current[fromId].ontrack = (event) => {
          console.log(`Received track from ${fromId}`, event.streams)
          const stream = event.streams[0]
          if (stream) {
            setVideos((prevVideos) => {
              const updatedVideos = [
                ...prevVideos.filter((v) => v.socketId !== fromId),
                { socketId: fromId, stream, autoplay: true, playsinline: true },
              ]
              videoRef.current = updatedVideos
              return updatedVideos
            })
          }
        }
      }
      connectionsRef.current[fromId]
        .setRemoteDescription(new RTCSessionDescription(offer))
        .then(() => {
          connectionsRef.current[fromId]
            .createAnswer()
            .then((description) => {
              connectionsRef.current[fromId]
                .setLocalDescription(description)
                .then(() => {
                  socketRef.current.emit("answer", {
                    meetingId,
                    answer: description,
                    toId: fromId,
                    fromId: socketIdRef.current,
                  })
                  console.log(`Answer sent to ${fromId}`)
                })
                .catch((e) => console.error("setLocalDescription error:", e))
            })
            .catch((e) => console.error("createAnswer error:", e))
        })
        .catch((e) => console.error("setRemoteDescription error:", e))
    })

    socketRef.current.on("answer", ({ answer, fromId }) => {
      if (fromId === socketIdRef.current || !socketIdRef.current) return
      console.log(`Received answer from ${fromId}`)
      if (connectionsRef.current[fromId]) {
        connectionsRef.current[fromId]
          .setRemoteDescription(new RTCSessionDescription(answer))
          .catch((e) => console.error("setRemoteDescription error:", e))
      } else {
        console.warn(`No connection for ${fromId} in answer`)
      }
    })

    socketRef.current.on("ice-candidate", ({ candidate, fromId }) => {
      if (fromId === socketIdRef.current || !connectionsRef.current[fromId] || !socketIdRef.current) return
      console.log(`Received ICE candidate from ${fromId}`)
      connectionsRef.current[fromId]
        .addIceCandidate(new RTCIceCandidate(candidate))
        .catch((e) => console.error("addIceCandidate error:", e))
    })

    socketRef.current.on("user-left", ({ id, updatedUserMap, updatedMediaStates }) => {
      console.log(`User ${id} left, username: ${users[id] || "unknown"}`)

      // Close and clean up peer connection
      if (connectionsRef.current[id]) {
        connectionsRef.current[id].close()
        delete connectionsRef.current[id]
      }

      // Remove video stream
      setVideos((prevVideos) => {
        const updatedVideos = prevVideos.filter((v) => v.socketId !== id)
        videoRef.current = updatedVideos
        console.log(
          "Videos after removal:",
          updatedVideos.map((v) => v.socketId),
        )
        return updatedVideos
      })

      // Update users list with the updated user map from server
      if (updatedUserMap) {
        setUsers(updatedUserMap)
        console.log("Updated users after removal:", updatedUserMap)
      } else {
        // Fallback: remove user manually
        setUsers((prevUsers) => {
          const updatedUsers = { ...prevUsers }
          delete updatedUsers[id]
          console.log("Users after removal (fallback):", updatedUsers)
          return updatedUsers
        })
      }

      // Update media states with the updated states from server
      if (updatedMediaStates) {
        setUserVideoStates(updatedMediaStates.video || {})
        setUserAudioStates(updatedMediaStates.audio || {})
      } else {
        // Fallback: clean up media states manually
        setUserVideoStates((prev) => {
          const updated = { ...prev }
          delete updated[id]
          return updated
        })
        setUserAudioStates((prev) => {
          const updated = { ...prev }
          delete updated[id]
          return updated
        })
      }
    })

    socketRef.current.on("receive-message", ({ message, userId, timestamp }) => {
      console.log(`Message from ${users[userId] || userId}: ${message}`)
      setMessages((prevMessages) => [...prevMessages, { data: message, sender: users[userId] || userId, timestamp }])
      if (userId !== username) {
        setNewMessages((prev) => prev + 1)
      }
    })
  }

  const silence = () => {
    const ctx = new AudioContext()
    const oscillator = ctx.createOscillator()
    const dst = oscillator.connect(ctx.createMediaStreamDestination())
    oscillator.start()
    ctx.resume()
    return Object.assign(dst.stream.getAudioTracks()[0], { enabled: false })
  }

  const black = ({ width = 640, height = 480 } = {}) => {
    const canvas = Object.assign(document.createElement("canvas"), { width, height })
    canvas.getContext("2d").fillRect(0, 0, width, height)
    const stream = canvas.captureStream()
    return Object.assign(stream.getVideoTracks()[0], { enabled: false })
  }

  const handleVideo = () => setVideo(!video)
  const handleAudio = () => setAudio(!audio)
  const handleScreen = () => setScreen(!screen)
  const handleEndCall = () => {
    try {
      if (window.localStream) {
        window.localStream.getTracks().forEach((track) => track.stop())
      }
    } catch (e) {
      console.error("Error stopping stream:", e)
    }
    for (const id in connectionsRef.current) {
      connectionsRef.current[id].close()
      delete connectionsRef.current[id]
    }
    if (socketRef.current) {
      socketRef.current.disconnect()
    }
    window.location.href = "/"
  }
  const openChat = () => {
    setModal(true)
    setNewMessages(0)
  }
  const closeChat = () => setModal(false)
  const handleMessage = (e) => setMessage(e.target.value)
  const sendMessage = () => {
    if (message.trim() && socketIdRef.current) {
      socketRef.current.emit("send-message", {
        meetingId,
        message,
        userId: username,
      })
      setMessage("")
    }
  }
  const validateUsername = (name) => {
    const regex = /^[a-zA-Z0-9]{3,}$/
    if (!name) {
      return "Username is required"
    }
    if (!regex.test(name)) {
      return "Username must be at least 3 characters and alphanumeric"
    }
    return ""
  }
  const connect = () => {
    const error = validateUsername(username)
    if (error) {
      setUsernameError(error)
      return
    }
    setUsernameError("")
    setAskForUsername(false)
    connectToSocketServer()
  }

  return (
    <div className="meeting-app">
      {askForUsername ? (
        <div className="meeting-lobby">
          <div className="meeting-lobby-content">
            <div className="meeting-lobby-header">
              <h2>Join Meeting</h2>
              <p>Enter your details to join the meeting</p>
            </div>

            <div className="meeting-preview-section">
              <div className="meeting-video-preview">
                <video ref={localVideoref} autoPlay muted className="meeting-preview-video" />
                <div className="meeting-preview-overlay">
                  <span className="meeting-preview-label">Preview</span>
                </div>
              </div>
            </div>

            <div className="meeting-form-section">
              <div className="meeting-input-group">
                <label htmlFor="username">Display Name</label>
                <input
                  id="username"
                  type="text"
                  placeholder="Enter your name"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value)
                    setUsernameError("")
                  }}
                  className="meeting-form-input"
                />
                {usernameError && <span className="meeting-error-message">{usernameError}</span>}
              </div>

              {meetingLink && (
                <div className="meeting-info-section">
                  <label className="meeting-link-label">Meeting Link</label>
                  <div className="meeting-link-container">
                    <input type="text" value={meetingLink} readOnly className="meeting-link-input" />
                    <button onClick={copyMeetingLink} className="meeting-copy-button">
                      <i className="fas fa-copy"></i>
                    </button>
                  </div>
                </div>
              )}

              <button onClick={connect} className="meeting-primary-button">
                Join Meeting
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="meeting-room">
          {showModal && (
            <div className="meeting-chat-panel">
              <div className="meeting-chat-header">
                <h3>Meeting Chat</h3>
                <button onClick={closeChat} className="meeting-close-button">
                  <i className="fas fa-times"></i>
                </button>
              </div>

              <div className="meeting-chat-messages">
                {messages.length ? (
                  messages.map((item, index) => (
                    <div className="meeting-message-item" key={index}>
                      <div className="meeting-message-header">
                        <span className="meeting-sender-name">{item.sender}</span>
                        <span className="meeting-message-time">
                          {item.timestamp ? new Date(item.timestamp).toLocaleTimeString() : ""}
                        </span>
                      </div>
                      <div className="meeting-message-content">{item.data}</div>
                    </div>
                  ))
                ) : (
                  <div className="meeting-no-messages">
                    <i className="fas fa-comments"></i>
                    <p>No messages yet</p>
                  </div>
                )}
              </div>

              <div className="meeting-chat-input-section">
                <div className="meeting-input-container">
                  <input
                    type="text"
                    placeholder="Type a message..."
                    value={message}
                    onChange={handleMessage}
                    className="meeting-chat-input"
                    onKeyPress={(e) => e.key === "Enter" && sendMessage()}
                  />
                  <button onClick={sendMessage} className="meeting-send-button">
                    <i className="fas fa-paper-plane"></i>
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="meeting-header">
            <div className="meeting-info">
              <h3>Meeting Room</h3>
              <span className="meeting-id">ID: {meetingId}</span>
            </div>
            <div className="meeting-participant-count">
              <i className="fas fa-users"></i>
              <span>{Object.keys(users).length} participants</span>
            </div>
          </div>

          <div className={`meeting-video-grid ${videos.length === 0 ? "single-user" : ""}`}>
            <div className="meeting-local-video-container">
              <video ref={localVideoref} autoPlay muted className="meeting-video-element" />
              <div className="meeting-video-overlay">
                <span className="meeting-participant-name">{username} (You)</span>
                <div className="meeting-media-indicators">
                  {!video && (
                    <div className="meeting-video-off-indicator">
                      <i className="fas fa-video-slash"></i>
                    </div>
                  )}
                  {!audio && (
                    <div className="meeting-audio-off-indicator">
                      <i className="fas fa-microphone-slash"></i>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {videos.map((video) => (
              <div key={video.socketId} className="meeting-remote-video-container">
                <video
                  data-socket={video.socketId}
                  ref={(ref) => {
                    if (ref && video.stream) {
                      ref.srcObject = video.stream
                    }
                  }}
                  autoPlay
                  playsInline
                  className="meeting-video-element"
                />
                <div className="meeting-video-overlay">
                  <span className="meeting-participant-name">{users[video.socketId] || "Unknown"}</span>
                  <div className="meeting-media-indicators">
                    {userVideoStates[video.socketId] === false && (
                      <div className="meeting-video-off-indicator">
                        <i className="fas fa-video-slash"></i>
                      </div>
                    )}
                    {userAudioStates[video.socketId] === false && (
                      <div className="meeting-audio-off-indicator">
                        <i className="fas fa-microphone-slash"></i>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="meeting-control-bar">
            <div className="meeting-control-group">
              <button
                onClick={handleAudio}
                className={`meeting-control-button ${!audio ? "meeting-disabled" : ""}`}
                title={audio ? "Mute" : "Unmute"}
              >
                <i className={`fas ${audio ? "fa-microphone" : "fa-microphone-slash"}`}></i>
              </button>

              <button
                onClick={handleVideo}
                className={`meeting-control-button ${!video ? "meeting-disabled" : ""}`}
                title={video ? "Turn off camera" : "Turn on camera"}
              >
                <i className={`fas ${video ? "fa-video" : "fa-video-slash"}`}></i>
              </button>

              {screenAvailable && (
                <button
                  onClick={handleScreen}
                  className={`meeting-control-button ${screen ? "meeting-active" : ""}`}
                  title={screen ? "Stop sharing" : "Share screen"}
                >
                  <i className={`fas ${screen ? "fa-stop-circle" : "fa-desktop"}`}></i>
                </button>
              )}
            </div>

            <div className="meeting-control-group">
              <button onClick={handleEndCall} className="meeting-control-button meeting-end-call" title="Leave meeting">
                <i className="fas fa-phone-slash"></i>
              </button>
            </div>

            <div className="meeting-control-group">
              <div className="meeting-chat-button-container">
                <button onClick={openChat} className="meeting-control-button" title="Open chat">
                  <i className="fas fa-comment"></i>
                </button>
                {newMessages > 0 && <span className="meeting-notification-badge">{newMessages}</span>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

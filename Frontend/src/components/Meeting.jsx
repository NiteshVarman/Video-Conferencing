import React, { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';
import './Meeting.css';

const server_url = 'http://localhost:5000';

const peerConfigConnections = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

export default function VideoMeetComponent() {
  const socketRef = useRef(null);
  const socketIdRef = useRef(null);
  const localVideoref = useRef(null);
  const connectionsRef = useRef({});
  const videoRef = useRef([]);
  const [videoAvailable, setVideoAvailable] = useState(true);
  const [audioAvailable, setAudioAvailable] = useState(true);
  const [video, setVideo] = useState(true);
  const [audio, setAudio] = useState(true);
  const [screen, setScreen] = useState(false);
  const [showModal, setModal] = useState(false);
  const [screenAvailable, setScreenAvailable] = useState(false);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [newMessages, setNewMessages] = useState(0);
  const [askForUsername, setAskForUsername] = useState(true);
  const [username, setUsername] = useState('');
  const [videos, setVideos] = useState([]);
  const [meetingId, setMeetingId] = useState('');

  useEffect(() => {
    // Load Font Awesome CDN
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
    document.head.appendChild(link);
    return () => document.head.removeChild(link);
  }, []);

  useEffect(() => {
    const pathParts = window.location.pathname.split('/');
    const id = pathParts[pathParts.length - 1];
    if (id) {
      setMeetingId(id);
      console.log(`Meeting ID set to: ${id}`);
      getPermissions();
    } else {
      console.error('No meeting ID found in URL');
    }
  }, []);

  const getPermissions = async () => {
    try {
      const videoPermission = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoPermission) {
        setVideoAvailable(true);
        console.log('Video permission granted');
      } else {
        setVideoAvailable(false);
        console.log('Video permission denied');
      }

      const audioPermission = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (audioPermission) {
        setAudioAvailable(true);
        console.log('Audio permission granted');
      } else {
        setAudioAvailable(false);
        console.log('Audio permission denied');
      }

      if (navigator.mediaDevices.getDisplayMedia) {
        setScreenAvailable(true);
      } else {
        setScreenAvailable(false);
      }

      if (videoAvailable || audioAvailable) {
        const userMediaStream = await navigator.mediaDevices.getUserMedia({
          video: videoAvailable,
          audio: audioAvailable,
        });
        if (userMediaStream) {
          window.localStream = userMediaStream;
          if (localVideoref.current) {
            localVideoref.current.srcObject = userMediaStream;
          }
        }
      }
    } catch (error) {
      console.error('Permission error:', error);
    }
  };

  useEffect(() => {
    if (video !== undefined && audio !== undefined) {
      getUserMedia();
    }
  }, [video, audio]);

  useEffect(() => {
    if (screen !== undefined) {
      getDisplayMedia();
    }
  }, [screen]);

  const getUserMedia = async () => {
    if ((video && videoAvailable) || (audio && audioAvailable)) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: video, audio: audio });
        getUserMediaSuccess(stream);
      } catch (e) {
        console.error('getUserMedia error:', e);
      }
    } else {
      try {
        if (localVideoref.current && localVideoref.current.srcObject) {
          let tracks = localVideoref.current.srcObject.getTracks();
          tracks.forEach((track) => track.stop());
        }
      } catch (e) {
        console.error('Error stopping tracks:', e);
      }
    }
  };

  const getUserMediaSuccess = (stream) => {
    try {
      if (window.localStream) {
        window.localStream.getTracks().forEach((track) => track.stop());
      }
    } catch (e) {
      console.error('Error stopping previous stream:', e);
    }

    window.localStream = stream;
    if (localVideoref.current) {
      localVideoref.current.srcObject = stream;
    }

    console.log('User media tracks:', {
      video: stream.getVideoTracks(),
      audio: stream.getAudioTracks(),
    });

    if (!socketIdRef.current) {
      console.error('Socket ID not initialized in getUserMediaSuccess');
      return;
    }

    for (let id in connectionsRef.current) {
      if (id === socketIdRef.current) continue;

      const videoTrack = stream.getVideoTracks()[0];
      const audioTrack = stream.getAudioTracks()[0];

      if (videoTrack) {
        connectionsRef.current[id].addTrack(videoTrack, stream);
        console.log(`Added video track for ${id}`);
      } else {
        console.warn(`No video track available for ${id}`);
      }

      if (audioTrack) {
        connectionsRef.current[id].addTrack(audioTrack, stream);
        console.log(`Added audio track for ${id}`);
      } else {
        console.warn(`No audio track available for ${id}`);
      }

      connectionsRef.current[id].createOffer().then((description) => {
        connectionsRef.current[id]
          .setLocalDescription(description)
          .then(() => {
            socketRef.current.emit('offer', {
              meetingId,
              offer: description,
              toUserId: id,
              fromUserId: socketIdRef.current,
            });
            console.log(`Offer sent from ${socketIdRef.current} to ${id}`);
          })
          .catch((e) => console.error('setLocalDescription error:', e));
      }).catch((e) => console.error('createOffer error:', e));
    }

    stream.getTracks().forEach((track) => {
      track.onended = () => {
        setVideo(false);
        setAudio(false);

        try {
          if (localVideoref.current && localVideoref.current.srcObject) {
            let tracks = localVideoref.current.srcObject.getTracks();
            tracks.forEach((track) => track.stop());
          }
        } catch (e) {
          console.error('Error stopping tracks on end:', e);
        }

        let blackSilence = (...args) => new MediaStream([black(...args), silence()]);
        window.localStream = blackSilence();
        if (localVideoref.current) {
          localVideoref.current.srcObject = window.localStream;
        }

        if (!socketIdRef.current) {
          console.error('Socket ID not initialized in track.onended');
          return;
        }

        for (let id in connectionsRef.current) {
          const videoTrack = window.localStream.getVideoTracks()[0];
          const audioTrack = window.localStream.getAudioTracks()[0];

          if (videoTrack) connectionsRef.current[id].addTrack(videoTrack, window.localStream);
          if (audioTrack) connectionsRef.current[id].addTrack(audioTrack, window.localStream);

          connectionsRef.current[id].createOffer().then((description) => {
            connectionsRef.current[id]
              .setLocalDescription(description)
              .then(() => {
                socketRef.current.emit('offer', {
                  meetingId,
                  offer: description,
                  toUserId: id,
                  fromUserId: socketIdRef.current,
                });
                console.log(`Offer sent from ${socketIdRef.current} to ${id} (track ended)`);
              })
              .catch((e) => console.error('setLocalDescription error:', e));
          }).catch((e) => console.error('createOffer error:', e));
        }
      };
    });
  };

  const getDisplayMedia = async () => {
    if (screen && navigator.mediaDevices.getDisplayMedia) {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        getDisplayMediaSuccess(stream);
      } catch (e) {
        console.error('getDisplayMedia error:', e);
      }
    }
  };

  const getDisplayMediaSuccess = (stream) => {
    try {
      if (window.localStream) {
        window.localStream.getTracks().forEach((track) => track.stop());
      }
    } catch (e) {
      console.error('Error stopping previous stream:', e);
    }

    window.localStream = stream;
    if (localVideoref.current) {
      localVideoref.current.srcObject = stream;
    }

    console.log('Display media tracks:', {
      video: stream.getVideoTracks(),
      audio: stream.getAudioTracks(),
    });

    if (!socketIdRef.current) {
      console.error('Socket ID not initialized in getDisplayMediaSuccess');
      return;
    }

    for (let id in connectionsRef.current) {
      if (id === socketIdRef.current) continue;

      const videoTrack = stream.getTracks()[0];
      const audioTrack = stream.getVideoTracks()[0];

      if (videoTrack) {
        connectionsRef.current[id].addTrack(videoTrack, stream);
        console.log(`Added video track for ${id} (screen)`);
      } else {
        console.warn(`No video track available for ${id} (screen)`);
      }

      if (audioTrack) {
        connectionsRef.current[id].addTrack(audioTrack, stream);
        console.log(`Added audio track for ${id} (screen)`);
      } else {
        console.warn(`No audio track available for ${id} (screen)`);
      }

      connectionsRef.current[id].createOffer().then((description) => {
        connectionsRef.current[id]
          .setLocalDescription(description)
          .then(() => {
            socketRef.current.emit('offer', {
              meetingId,
              offer: description,
              toUserId: id,
              fromUserId: socketIdRef.current,
            });
            console.log(`Offer sent from ${socketIdRef.current} to ${id} (screen)`);
          })
          .catch((e) => console.error('setLocalDescription error:', e));
      }).catch((e) => console.error('createOffer error:', e));
    }

    stream.getTracks().forEach((track) => {
      track.onended = () => {
        setScreen(false);

        try {
          if (localVideoref.current && localVideoref.current.srcObject) {
            let tracks = localVideoref.current.srcObject.getTracks();
            tracks.forEach((track) => track.stop());
          }
        } catch (e) {
          console.error('Error stopping tracks on end:', e);
        }

        let blackSilence = (...args) => new MediaStream([black(...args), silence()]);
        window.localStream = blackSilence();
        if (localVideoref.current) {
          localVideoref.current.srcObject = window.localStream;
        }

        getUserMedia();
      };
    });
  };

  const connectToSocketServer = () => {
    socketRef.current = io.connect(server_url, { secure: false });

    socketRef.current.on('connect', () => {
      socketIdRef.current = socketRef.current.id;
      console.log(`Socket connected with ID: ${socketIdRef.current}`);
      
      socketRef.current.emit('join-meeting', {
        meetingId,
        userId: username || socketIdRef.current,
      });
      console.log(`Joined meeting ${meetingId} as ${username || socketIdRef.current}`);
    });

    socketRef.current.on('error', ({ message }) => {
      console.error('Socket error:', message);
      alert(message);
    });

    socketRef.current.on('user-joined', ({ id, clients }) => {
      console.log(`User joined: ${id}, Clients: ${clients}`);
      
      // Process all clients, including the newly joined user
      const uniqueClients = [...new Set([...clients, id])]; // Ensure no duplicates
      uniqueClients.forEach((socketListId) => {
        if (socketListId === socketIdRef.current || connectionsRef.current[socketListId]) return;

        connectionsRef.current[socketListId] = new RTCPeerConnection(peerConfigConnections);

        connectionsRef.current[socketListId].onicecandidate = (event) => {
          if (event.candidate && socketIdRef.current) {
            socketRef.current.emit('ice-candidate', {
              meetingId,
              candidate: event.candidate,
              toUserId: socketListId,
              fromUserId: socketIdRef.current,
            });
            console.log(`ICE candidate sent from ${socketIdRef.current} to ${socketListId}`);
          }
        };

        connectionsRef.current[socketListId].ontrack = (event) => {
          console.log(`Received track from ${socketListId}`, event.streams);
          const stream = event.streams[0];
          if (!stream) return;

          // Check if stream already exists to prevent duplicates
          const streamExists = videos.some((video) => 
            video.socketId === socketListId && video.stream.id === stream.id
          );
          if (streamExists) {
            console.log(`Stream from ${socketListId} already exists, skipping`);
            return;
          }

          setVideos((prevVideos) => {
            const videoExists = prevVideos.find((video) => video.socketId === socketListId);
            let updatedVideos;
            if (videoExists) {
              updatedVideos = prevVideos.map((video) =>
                video.socketId === socketListId ? { ...video, stream } : video
              );
            } else {
              updatedVideos = [
                ...prevVideos,
                {
                  socketId: socketListId,
                  stream,
                  autoplay: true,
                  playsinline: true,
                },
              ];
            }
            videoRef.current = updatedVideos;
            return updatedVideos;
          });
        };

        if (window.localStream) {
          window.localStream.getTracks().forEach((track) => {
            connectionsRef.current[socketListId].addTrack(track, window.localStream);
            console.log(`Added track to ${socketListId} in user-joined`);
          });
        } else {
          let blackSilence = (...args) => new MediaStream([black(...args), silence()]);
          window.localStream = blackSilence();
          window.localStream.getTracks().forEach((track) => {
            connectionsRef.current[socketListId].addTrack(track, window.localStream);
          });
        }
      });
    });

    socketRef.current.on('offer', ({ offer, fromUserId }) => {
      if (fromUserId !== socketIdRef.current && socketIdRef.current) {
        console.log(`Received offer from ${fromUserId}`);
        connectionsRef.current[fromUserId]
          .setRemoteDescription(new RTCSessionDescription(offer))
          .then(() => {
            connectionsRef.current[fromUserId].createAnswer().then((description) => {
              connectionsRef.current[fromUserId]
                .setLocalDescription(description)
                .then(() => {
                  socketRef.current.emit('answer', {
                    meetingId,
                    answer: description,
                    toUserId: fromUserId,
                    fromUserId: socketIdRef.current,
                  });
                  console.log(`Answer sent from ${socketIdRef.current} to ${fromUserId}`);
                })
                .catch((e) => console.error('setLocalDescription error:', e));
            }).catch((e) => console.error('createAnswer error:', e));
          })
          .catch((e) => console.error('setRemoteDescription error:', e));
      }
    });

    socketRef.current.on('answer', ({ answer, fromUserId }) => {
      if (fromUserId !== socketIdRef.current && socketIdRef.current) {
        console.log(`Received answer from ${fromUserId}`);
        connectionsRef.current[fromUserId]
          .setRemoteDescription(new RTCSessionDescription(answer))
          .catch((e) => console.error('setRemoteDescription error:', e));
      }
    });

    socketRef.current.on('ice-candidate', ({ candidate, fromUserId }) => {
      if (fromUserId !== socketIdRef.current && connectionsRef.current[fromUserId] && socketIdRef.current) {
        console.log(`Received ICE candidate from ${fromUserId}`);
        connectionsRef.current[fromUserId]
          .addIceCandidate(new RTCIceCandidate(candidate))
          .catch((e) => console.error('addIceCandidate error:', e));
      }
    });

    socketRef.current.on('user-left', ({ userId }) => {
      console.log(`User left: ${userId}`);
      if (connectionsRef.current[userId]) {
        connectionsRef.current[userId].close();
        delete connectionsRef.current[userId];
      }
      setVideos((videos) => videos.filter((video) => video.socketId !== userId));
    });

    socketRef.current.on('receive-message', ({ message, userId, timestamp }) => {
      console.log(`Received message from ${userId}: ${message}`);
      setMessages((prevMessages) => [
        ...prevMessages,
        { sender: userId, data: message, timestamp },
      ]);
      if (userId !== (username || socketIdRef.current)) {
        setNewMessages((prev) => prev + 1);
      }
    });
  };

  const silence = () => {
    let ctx = new AudioContext();
    let oscillator = ctx.createOscillator();
    let dst = oscillator.connect(ctx.createMediaStreamDestination());
    oscillator.start();
    ctx.resume();
    return Object.assign(dst.stream.getAudioTracks()[0], { enabled: false });
  };

  const black = ({ width = 640, height = 480 } = {}) => {
    let canvas = Object.assign(document.createElement('canvas'), { width, height });
    canvas.getContext('2d').fillRect(0, 0, width, height);
    let stream = canvas.captureStream();
    return Object.assign(stream.getVideoTracks()[0], { enabled: false });
  };

  const handleVideo = () => setVideo(!video);
  const handleAudio = () => setAudio(!audio);
  const handleScreen = () => setScreen(!screen);
  const handleEndCall = () => {
    try {
      if (window.localStream) {
        window.localStream.getTracks().forEach((track) => track.stop());
      }
    } catch (e) {
      console.error('Error stopping stream:', e);
    }
    for (let id in connectionsRef.current) {
      connectionsRef.current[id].close();
      delete connectionsRef.current[id];
    }
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
    window.location.href = '/';
  };
  const openChat = () => {
    setModal(true);
    setNewMessages(0);
  };
  const closeChat = () => setModal(false);
  const handleMessage = (e) => setMessage(e.target.value);
  const sendMessage = () => {
    if (message.trim() && socketIdRef.current) {
      socketRef.current.emit('send-message', {
        meetingId,
        message,
        userId: username || socketIdRef.current,
      });
      setMessage('');
    }
  };
  const connect = () => {
    if (username.trim()) {
      setAskForUsername(false);
      connectToSocketServer();
    }
  };

  return (
    <div className="container">
      {askForUsername ? (
        <div className="lobby">
          <h2>Enter into Lobby</h2>
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="username-input"
          />
          <button onClick={connect} className="connect-button">
            Connect
          </button>
          <div>
            <video ref={localVideoref} autoPlay muted className="meet-user-video" />
          </div>
        </div>
      ) : (
        <div className="meet-video-container">
          {showModal && (
            <div className="chat-room">
              <div className="chat-container">
                <h1>Chat</h1>
                <div className="chatting-display">
                  {messages.length ? (
                    messages.map((item, index) => (
                      <div className="message" key={index}>
                        <p className="sender">{item.sender}</p>
                        <p>{item.data}</p>
                      </div>
                    ))
                  ) : (
                    <p>No Messages Yet</p>
                  )}
                </div>
                <div className="chatting-area">
                  <input
                    type="text"
                    placeholder="Enter Your Chat"
                    value={message}
                    onChange={handleMessage}
                    className="chat-input"
                  />
                  <button onClick={sendMessage} className="send-button">
                    Send
                  </button>
                </div>
              </div>
            </div>
          )}
          <div className="button-containers">
            <button onClick={handleVideo} className="icon-button">
              <i className={`fas ${video ? 'fa-video' : 'fa-video-slash'}`}></i>
            </button>
            <button onClick={handleEndCall} className="icon-button end-call">
              <i className="fas fa-phone-slash"></i>
            </button>
            <button onClick={handleAudio} className="icon-button">
              <i className={`fas ${audio ? 'fa-microphone' : 'fa-microphone-slash'}`}></i>
            </button>
            {screenAvailable && (
              <button onClick={handleScreen} className="icon-button">
                <i className={`fas ${screen ? 'fa-desktop' : 'fa-stop-circle'}`}></i>
              </button>
            )}
            <div className="badge-wrapper">
              <button onClick={openChat} className="icon-button">
                <i className="fas fa-comment"></i>
              </button>
              {newMessages > 0 && <span className="badge">{newMessages}</span>}
            </div>
          </div>
          <video ref={localVideoref} autoPlay muted className="meet-user-video" />
          <div className="conference-view">
            {videos.map((video) => (
              <div key={video.socketId} className="video-wrapper">
                <video
                  data-socket={video.socketId}
                  ref={(ref) => {
                    if (ref && video.stream) {
                      ref.srcObject = video.stream;
                    }
                  }}
                  autoPlay
                  playsInline
                  className="meet-user-video"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
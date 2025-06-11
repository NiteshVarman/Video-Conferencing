import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import io from 'socket.io-client';
import SimplePeer from 'simple-peer';
import axios from 'axios';

function Meeting() {
  const { meetingId } = useParams();
  const [users, setUsers] = useState({}); // Unified state for all users (including self)
  const [messages, setMessages] = useState([]);
  const [chatMessage, setChatMessage] = useState('');
  const socketRef = useRef();
  const userVideoRef = useRef();
  const peersRef = useRef({});
  const streamRef = useRef();

  useEffect(() => {
    socketRef.current = io('http://localhost:5000');

    const init = async () => {
      try {
        // Validate meeting ID
        await axios.get(`http://localhost:5000/api/meetings/validate/${meetingId}`);

        // Get user media
        streamRef.current = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

        // Add self to users state
        setUsers((prev) => ({
          ...prev,
          [socketRef.current.id]: { stream: streamRef.current, isSelf: true },
        }));

        if (userVideoRef.current) {
          userVideoRef.current.srcObject = streamRef.current;
        }

        // Join meeting
        socketRef.current.emit('join-meeting', {
          meetingId,
          userId: socketRef.current.id,
        });

        // Handle current users
        socketRef.current.on('current-users', ({ users }) => {
          users.forEach((userId) => {
            if (userId !== socketRef.current.id && !peersRef.current[userId]) {
              createPeer(userId, socketRef.current.id);
            }
          });
        });

        // Handle user joined
        socketRef.current.on('user-joined', ({ userId }) => {
          if (!peersRef.current[userId]) {
            createPeer(userId, socketRef.current.id, true);
          }
        });

        // Handle user left
        socketRef.current.on('user-left', ({ userId }) => {
          if (peersRef.current[userId]) {
            peersRef.current[userId].peer.destroy();
            delete peersRef.current[userId];
            setUsers((prev) => {
              const updated = { ...prev };
              delete updated[userId];
              return updated;
            });
          }
        });

        // Handle WebRTC offer
        socketRef.current.on('offer', ({ offer, fromUserId }) => {
          createPeer(fromUserId, socketRef.current.id, false, offer);
        });

        // Handle WebRTC answer
        socketRef.current.on('answer', ({ answer, fromUserId }) => {
          if (peersRef.current[fromUserId]) {
            peersRef.current[fromUserId].peer.signal(answer);
          }
        });

        // Handle ICE candidate
        socketRef.current.on('ice-candidate', ({ candidate, fromUserId }) => {
          if (peersRef.current[fromUserId]) {
            peersRef.current[fromUserId].peer.signal(candidate);
          }
        });

        // Handle chat messages
        socketRef.current.on('receive-message', ({ message, userId, timestamp }) => {
          setMessages((prev) => [
            ...prev,
            { message, userId, timestamp: new Date(timestamp).toLocaleTimeString() },
          ]);
        });

        socketRef.current.on('error', ({ message }) => {
          console.error('Socket error:', message);
          alert(message);
        });
      } catch (error) {
        console.error('Error initializing meeting:', error);
        alert('Invalid meeting or media access denied');
      }
    };

    init();

    return () => {
      socketRef.current?.disconnect();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      Object.values(peersRef.current).forEach(({ peer }) => peer.destroy());
      peersRef.current = {};
    };
  }, [meetingId]);

  const createPeer = (peerUserId, userId, initiator = false, offer = null) => {
    const peer = new SimplePeer({
      initiator,
      trickle: false,
      stream: streamRef.current,
    });

    peer.on('signal', (data) => {
      if (data.type === 'offer') {
        socketRef.current.emit('offer', {
          meetingId,
          offer: data,
          toUserId: peerUserId,
          fromUserId: userId,
        });
      } else if (data.type === 'answer') {
        socketRef.current.emit('answer', {
          meetingId,
          answer: data,
          toUserId: peerUserId,
          fromUserId: userId,
        });
      } else if (data.candidate) {
        socketRef.current.emit('ice-candidate', {
          meetingId,
          candidate: data,
          toUserId: peerUserId,
          fromUserId: userId,
        });
      }
    });

    peer.on('stream', (stream) => {
      setUsers((prevUsers) => ({
        ...prevUsers,
        [peerUserId]: { stream, isSelf: false },
      }));
    });

    peer.on('error', (err) => {
      console.error(`Peer error for ${peerUserId}:`, err);
    });

    if (offer) {
      peer.signal(offer);
    }

    peersRef.current[peerUserId] = { peer, peerUserId };
  };

  const sendMessage = () => {
    if (chatMessage.trim()) {
      socketRef.current.emit('send-message', {
        meetingId,
        message: chatMessage,
        userId: socketRef.current.id,
      });
      setChatMessage('');
    }
  };

  return (
    <div className="container">
      <h1>Meeting: {meetingId}</h1>
      <h2>Participants ({Object.keys(users).length})</h2>
      <ul className="participant-list">
        {Object.keys(users).map((userId) => (
          <li key={userId}>{users[userId].isSelf ? 'You' : userId.slice(0, 8)}</li>
        ))}
      </ul>
      <div className="video-grid">
        {Object.entries(users).map(([userId, { stream, isSelf }]) => (
          <div key={userId} className="video-container">
            <video
              ref={(video) => {
                if (video && stream) video.srcObject = stream;
              }}
              autoPlay
              muted={isSelf}
              playsInline
            />
            <div className="user-label">{isSelf ? 'You' : userId.slice(0, 8)}</div>
          </div>
        ))}
      </div>
      <div className="chat-container">
        <h2>Chat</h2>
        <div className="chat-messages">
          {messages.map((msg, index) => (
            <div key={index}>
              <strong>{msg.userId === socketRef.current?.id ? 'You' : msg.userId.slice(0, 8)}</strong> [
              {msg.timestamp}]: {msg.message}
            </div>
          ))}
        </div>
        <div className="chat-input">
          <input
            type="text"
            value={chatMessage}
            onChange={(e) => setChatMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Type a message..."
          />
          <button onClick={sendMessage}>Send</button>
        </div>
      </div>
    </div>
  );
}

export default Meeting;
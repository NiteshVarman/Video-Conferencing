import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Home.css';

const server_url = 'https://api.video-meet.me';


export default function Home() {
  const navigate = useNavigate();
  const [meetingId, setMeetingId] = useState('');

  const createNewMeeting = async () => {
    try {
      const response = await fetch(`${server_url}/api/meetings/new`, { method: 'POST' });
      const data = await response.json();
      if (data.meetingId) {
        navigate(`/join/${data.meetingId}`);
      } else {
        console.error('Failed to create meeting');
        alert('Failed to create meeting');
      }
    } catch (error) {
      console.error('Error creating meeting:', error);
      alert('Error creating meeting');
    }
  };
  
    const joinMeeting = () => {
      if (meetingId.trim()) {
        navigate(`/join/${meetingId}`);
      } else {
        alert('Please enter a meeting ID');
      }
    };
  
  return (
    <div className="home-page">
      <div className="home-container">
        <div className="home-header">
          <div className="home-brand">
            <div className="home-brand-icon">
              <i className="fas fa-video"></i>
            </div>
            <h1 className="home-brand-title">VideoMeet Pro</h1>
            <p className="home-brand-subtitle">Connect, collaborate, and communicate seamlessly</p>
          </div>
        </div>

        <div className="home-actions">
          <div className="home-action-card">
            <h3>Start New Meeting</h3>
            <p>Create a new meeting room and invite others</p>
            <button onClick={createNewMeeting} className="home-primary-btn">
              <i className="fas fa-plus"></i>
              New Meeting
            </button>
          </div>

          <div className="home-action-card">
            <h3>Join Meeting</h3>
            <p>Enter a meeting ID to join an existing meeting</p>
            <div className="home-join-form">
              <input
                type="text"
                placeholder="Enter Meeting ID"
                value={meetingId}
                onChange={(e) => setMeetingId(e.target.value)}
                className="home-meeting-input"
              />
              <button onClick={joinMeeting} className="home-secondary-btn">
                <i className="fas fa-sign-in-alt"></i>
                Join
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

function Home() {
  const [meetingId, setMeetingId] = useState('');
  const navigate = useNavigate();

  const createMeeting = async () => {
    try {
      const response = await axios.post('http://localhost:5000/api/meetings/new');
      const { meetingId } = response.data;
      navigate(`/join/${meetingId}`);
    } catch (error) {
      console.error('Error creating meeting:', error);
      alert('Failed to create meeting');
    }
  };

  const joinMeeting = () => {
    if (meetingId) {
      navigate(`/join/${meetingId}`);
    } else {
      alert('Please enter a meeting ID');
    }
  };

  return (
    <div className="container">
      <h1>Video Meet</h1>
      <button onClick={createMeeting}>New Meeting</button>
      <div>
        <input
          type="text"
          placeholder="Enter Meeting ID"
          value={meetingId}
          onChange={(e) => setMeetingId(e.target.value)}
        />
        <button onClick={joinMeeting}>Join Meeting</button>
      </div>
    </div>
  );
}

export default Home;
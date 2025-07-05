# Video Conferencing Tool 📹

A modern, real-time video conferencing application built with Node.js, Express, Socket.IO, React, and WebRTC. This app enables users to create and join meetings, share video/audio, screen share, and communicate via a built-in chat system. The application is designed for seamless, scalable, and secure communication.

---

## 🌟 Features

- **Create & Join Meetings**: Generate unique meeting IDs and shareable links
- **Real-Time Communication**: Peer-to-peer video/audio using WebRTC
- **Screen Sharing**: Share your screen with participants
- **In-Meeting Chat**: Text messaging during video calls
- **Media Controls**: Toggle video/audio with intuitive buttons
- **Participant Management**: View connected users and their status
- **Responsive UI**: Works on desktop and mobile devices
- **Secure**: MongoDB storage for meeting data

---

## 🛠️ Tech Stack

### Backend
- Node.js
- Express
- Socket.IO
- MongoDB (with Mongoose)
- UUID

### Frontend
- React
- React Router
- WebRTC
- Socket.IO Client
- CSS

---

## 📂 Project Structure
```
├── backend/
│   ├── models/
│   │   └── meeting.js          # Mongoose schema for meetings
│   ├── routes/
│   │   └── meeting.js          # API routes for meeting creation/validation
│   ├── socket/
│   │   └── socket.js           # Socket.IO setup for real-time communication
│   ├── .env                    # Environment variables (MongoDB URL, PORT)
│   ├── app.js                  # Main server file
│   ├── package.json            # Backend dependencies
│   └── package-lock.json       # Dependency lock file
├── frontend/
│   ├── public/                 # Static assets
│   ├── src/
│   │   ├── assets/             # Images or other assets
│   │   ├── components/
│   │   │   ├── Home.jsx        # Home page component
│   │   │   ├── Home.css        # Home page styles
│   │   │   ├── Meeting.jsx     # Meeting room component
│   │   │   └── Meeting.css     # Meeting room styles
│   │   ├── App.jsx             # Main React app component
│   │   ├── App.css             # Global app styles
│   │   ├── index.css           # Global styles
│   │   └── main.jsx            # React entry point
│   ├── package.json            # Frontend dependencies
│   └── package-lock.json       # Dependency lock file
├── README.md                   # Project documentation
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v16 or higher)
- MongoDB (local or Atlas)
- Git

### Installation

#### 1. Clone the Repository
```
git clone https://github.com/NiteshVarman/Video-Conferencing.git
cd Video-Conferencing
```

#### 2. Install Backend Dependencies
```
cd Backend
npm install
```

#### 3. Install Frontend Dependencies
```
cd Frontend
npm install
```

---

## 🖥️ Usage

### 1. Create a Meeting:

- Visit the home page (/) and click "Create Meeting".
- A unique meeting ID and link will be generated (e.g., http://localhost:3000/join/<meetingId>).
- Copy and share the link with participants.

### 2. Join a Meeting:
- Enter a display name and join using the meeting link or ID.
- Allow browser permissions for camera and microphone.

### 3. Meeting Room:
- Toggle video, audio, or screen sharing using the control bar.
- Open the chat panel to send/receive messages.
- View participant count and their media states (video/audio on/off).
- Click "Leave Meeting" to disconnect.

---

## 📈 Future Improvements
- Authentication: Add user authentication for secure access.
- Recording: Enable meeting recording and playback.
- Breakout Rooms: Support for smaller group discussions within meetings.
- File Sharing: Allow file uploads in the chat.
- Mobile Optimization: Enhance responsiveness for mobile devices.
- End-to-End Encryption: Secure WebRTC streams.

---

## 🤝 Contributing

Contributions are welcome! Follow these steps:
Fork the repository.
Create a new branch (git checkout -b feature/your-feature).
Commit your changes (git commit -m "Add your feature").
Push to the branch (git push origin feature/your-feature).
Open a Pull Request.
Please ensure your code follows the project's coding style and includes tests where applicable.

---

## 📜 License
This project is licensed under the MIT License. See the LICENSE file for details.

---
⭐ Star this repository if you find it useful! Happy coding! 🚀

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './components/Home';
import Meeting from './components/meeting';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/join/:meetingId" element={<Meeting />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
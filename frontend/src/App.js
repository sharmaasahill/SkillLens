import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import JobRecommender from './pages/JobRecommender';
import ResumeAnalyzer from './pages/ResumeAnalyzer';
import AuthPage from './pages/AuthPage';
import Profile from './pages/Profile';
import AdminPage from './pages/AdminPage';
import AdminLogin from './pages/AdminLogin';
import SalaryPredictor from './pages/SalaryPredictor'; 

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/admin-login" element={<AdminLogin />} />
        <Route path="/job-recommender" element={<JobRecommender />} />
        <Route path="/resume-analyzer" element={<ResumeAnalyzer />} />
        <Route path="/salary-predictor" element={<SalaryPredictor />} /> {/* Salary route */}
      </Routes>
    </Router>
  );
}

export default App;

import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout/Layout';
import Dashboard from './components/Dashboard/Dashboard';
import Campaigns from './components/Campaigns/Campaigns';
import ProfileList from './components/ProfileList';
import './App.css';

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/campaigns" element={<Campaigns />} />
          <Route path="/profiles" element={<ProfileList />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;

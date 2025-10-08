// Layout component for consistent page structure
import React from 'react';
import { Link } from 'react-router-dom';
import './Layout.css';

function Layout({ children }) {
  return (
    <div className="app-container">
      <header className="header">
        <h1>LinkedIn Automation</h1>
      </header>
      <div className="main-content">
        <nav className="sidebar">
          <ul>
            <li>
              <Link to="/">Dashboard</Link>
            </li>
            <li>
              <Link to="/campaigns">Campaigns</Link>
            </li>
            <li>
              <Link to="/profiles">Profiles</Link>
            </li>
          </ul>
        </nav>
        <main className="content">
          {children}
        </main>
      </div>
    </div>
  );
}

export default Layout;
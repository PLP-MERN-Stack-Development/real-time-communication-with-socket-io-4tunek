import React, { useState } from 'react';
import './Login.css';

export default function Login({ onLogin, onSignup }) {
  const [mode, setMode] = useState('login'); 
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    try {
      setError('');

      // Trim inputs
      const trimmedName = name.trim();
      const trimmedEmail = email.trim();
      const trimmedPassword = password;

      if (mode === 'login') {
        if (!trimmedEmail || !trimmedPassword) {
          return setError('Email and password required');
        }

        console.log('Login request:', { email: trimmedEmail, password: trimmedPassword });
        await onLogin(trimmedEmail, trimmedPassword); 

      } else {
        if (!trimmedName || !trimmedEmail || !trimmedPassword) {
          return setError('All fields required');
        }

        console.log('Signup request:', { name: trimmedName, email: trimmedEmail, password: trimmedPassword });
        await onSignup(trimmedName, trimmedEmail, trimmedPassword); 
      }

    } catch (err) {
      console.error('Auth error:', err.response?.data || err.message);
      setError(err.response?.data?.message || err.message || 'An error occurred');
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1 className="app-title">ChatterBox</h1>

        {mode === 'signup' && (
          <input
            type="text"
            placeholder="Display Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        )}

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && <p className="error">{error}</p>}

        <button onClick={handleSubmit}>
          {mode === 'login' ? 'Login' : 'Sign Up'}
        </button>

        <p className="toggle-text">
          {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
          <span
            className="toggle-link"
            onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
          >
            {mode === 'login' ? 'Sign Up' : 'Login'}
          </span>
        </p>
      </div>
    </div>
  );
}

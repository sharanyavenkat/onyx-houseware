import LoginForm from '../components/LoginForm';
import { useState } from 'react';

export default function Login() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = (username: string, password: string) => {
    console.log('Login attempt for:', username);
    setIsLoading(true);
    setError('');
    
    // TODO: Implement actual authentication
    setTimeout(() => {
      if (username === 'onyx.admin' && password === 'admin123') {
        console.log('Login successful - redirecting to dashboard');
        // TODO: Set authentication state and redirect
        setIsLoading(false);
      } else {
        setError('Invalid username or password');
        setIsLoading(false);
      }
    }, 1500);
  };

  return (
    <LoginForm 
      onLogin={handleLogin}
      isLoading={isLoading}
      error={error}
    />
  );
}
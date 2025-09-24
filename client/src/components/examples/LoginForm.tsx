import LoginForm from '../LoginForm';
import { useState } from 'react';

export default function LoginFormExample() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const handleLogin = (username: string, password: string) => {
    setIsLoading(true);
    setError('');
    
    // Simulate login
    setTimeout(() => {
      if (username === 'admin' && password === 'password') {
        console.log('Login successful');
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
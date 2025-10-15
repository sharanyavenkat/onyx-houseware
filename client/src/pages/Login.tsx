import LoginForm from '../components/LoginForm';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';

export default function Login() {
  const [error, setError] = useState('');

  const loginMutation = useMutation({
    mutationFn: async (data: { username: string; password: string }) => {
      return await apiRequest('POST', '/api/auth/login', data);
    },
    onSuccess: () => {
      // Invalidate auth/me query to refetch user data
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
    },
    onError: (error: Error) => {
      setError(error.message || 'Invalid username or password');
    },
  });

  const handleLogin = (username: string, password: string) => {
    setError('');
    loginMutation.mutate({ username, password });
  };

  return (
    <LoginForm 
      onLogin={handleLogin}
      isLoading={loginMutation.isPending}
      error={error}
    />
  );
}
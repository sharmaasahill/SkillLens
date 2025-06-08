import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginType, setLoginType] = useState('user'); // 'user' or 'hr'
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userType = localStorage.getItem('userType');
    if (token) {
      if (userType === 'hr') {
        navigate('/hr-dashboard', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    }
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        const response = await axios.post('http://localhost:5000/login', {
          email,
          password
        });

        if (response.data.token) {
          localStorage.setItem('token', response.data.token);
          localStorage.setItem('userEmail', response.data.email);
          localStorage.setItem('userType', response.data.is_admin ? 'hr' : 'user');
          
          // Navigate based on user type
          if (response.data.is_admin) {
            navigate('/hr-dashboard', { replace: true });
          } else {
            navigate('/', { replace: true });
          }
        }
      } else {
        const response = await axios.post('http://localhost:5000/register', {
          email,
          password,
          full_name: fullName
        });

        if (response.data.token) {
          localStorage.setItem('token', response.data.token);
          localStorage.setItem('userEmail', response.data.email);
          navigate('/', { replace: true });
        }
      }
    } catch (err) {
      console.error('Auth error:', err);
      setError(err.response?.data?.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-lg shadow-md">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            {isLogin ? 'Sign in to your account' : 'Create your account'}
          </h2>
          
          {isLogin && (
            <div className="mt-4">
              <div className="flex justify-center space-x-4">
                <button
                  type="button"
                  onClick={() => {
                    setLoginType('user');
                    setEmail('');
                    setPassword('');
                  }}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    loginType === 'user' 
                      ? 'bg-blue-100 text-blue-700 border-2 border-blue-500' 
                      : 'bg-gray-100 text-gray-700 border-2 border-gray-300 hover:bg-gray-200'
                  }`}
                >
                  👤 Login as User
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLoginType('hr');
                    setEmail('hr.itcareer@gmail.com');
                    setPassword('hritcareer');
                  }}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    loginType === 'hr' 
                      ? 'bg-purple-100 text-purple-700 border-2 border-purple-500' 
                      : 'bg-gray-100 text-gray-700 border-2 border-gray-300 hover:bg-gray-200'
                  }`}
                >
                  👔 Login as HR
                </button>
              </div>
              {loginType === 'hr' && (
                <div className="mt-2 text-center">
                  <p className="text-sm text-gray-600">HR credentials pre-filled</p>
                </div>
              )}
            </div>
          )}
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
              <span className="block sm:inline">{error}</span>
            </div>
          )}
          <div className="rounded-md shadow-sm -space-y-px">
            {!isLogin && (
              <div>
                <label htmlFor="fullName" className="sr-only">Full Name</label>
                <input
                  id="fullName"
                  name="fullName"
                  type="text"
                  required
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                  placeholder="Full Name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
            )}
            <div>
              <label htmlFor="email" className="sr-only">Email address</label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className={`appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 ${
                  !isLogin ? '' : 'rounded-t-md'
                } focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm`}
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className={`group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white ${
                loading ? 'bg-indigo-400' : 'bg-indigo-600 hover:bg-indigo-700'
              } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
            >
              {loading ? 'Processing...' : (isLogin ? 'Sign in' : 'Sign up')}
            </button>
          </div>

          <div className="text-center">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-indigo-600 hover:text-indigo-500"
            >
              {isLogin ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Auth; 
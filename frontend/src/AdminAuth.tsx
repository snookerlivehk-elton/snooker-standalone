import React, { useState } from 'react';

const AdminAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'wwww5678') {
      setIsAuthenticated(true);
      setError('');
    } else {
      setError('Incorrect password');
    }
  };

  if (isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8 flex flex-col items-center justify-center">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold mb-6 text-center">Admin Access</h1>
        <form onSubmit={handleSubmit} className="bg-gray-800 rounded-lg shadow-lg p-8">
          <div className="mb-4">
            <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition-colors">
            Enter
          </button>
          {error && <p className="text-red-500 mt-4 text-center">{error}</p>}
        </form>
      </div>
    </div>
  );
};

export default AdminAuth;
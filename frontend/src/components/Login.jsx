import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const Login = ({ onLogin }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [errors, setErrors] = useState({});
    const navigate = useNavigate();

    const validateForm = () => {
        const newErrors = {};
        if (!email) {
            newErrors.email = 'Email is required';
        } else if (!/\S+@\S+\.\S+/.test(email)) {
            newErrors.email = 'Email address is invalid';
        }
        if (!password) {
            newErrors.password = 'Password is required';
        }
        return newErrors;
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const formErrors = validateForm();
        if (Object.keys(formErrors).length > 0) {
            setErrors(formErrors);
        } else {
            const savedUser = localStorage.getItem('user');
            if (savedUser) {
                onLogin(JSON.parse(savedUser));
            } else {
                const fakeUser = {
                    memberId: 'KKT123456',
                    displayName: 'Test User',
                    email: email,
                    phone: '12345678',
                    area: 'Kowloon',
                    district: 'KKT',
                };
                onLogin(fakeUser);
            }
            navigate('/dashboard');
            setErrors({});
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
            <div className="w-full max-w-md p-8 space-y-6 bg-gray-800 rounded-lg shadow-lg">
                <h2 className="text-2xl font-bold text-center">Login</h2>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium">Email</label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-3 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                        />
                        {errors.email && <p className="mt-2 text-sm text-red-500">{errors.email}</p>}
                    </div>
                    <div>
                        <label htmlFor="password" className="block text-sm font-medium">Password</label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-3 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                        />
                        {errors.password && <p className="mt-2 text-sm text-red-500">{errors.password}</p>}
                    </div>
                    <button
                        type="submit"
                        className="w-full bg-blue-500 text-white py-2 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
                    >
                        Login
                    </button>
                </form>
                <p className="text-center text-gray-600 mt-4">
                    Don't have an account yet? <Link to="/register" className="text-blue-500 hover:underline">Register now</Link>
                </p>
            </div>
        </div>
    );
};

export default Login;
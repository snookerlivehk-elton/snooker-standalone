import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FaUser, FaEnvelope, FaPhone, FaMapMarkerAlt, FaIdCard, FaKey, FaPlus } from 'react-icons/fa';
import { areaCodes } from '../lib/areaCodes';

const Dashboard = ({ user }) => {
  const navigate = useNavigate();

  const getDistrictName = (area, districtCode) => {
    if (areaCodes[area]) {
      const district = areaCodes[area].find(d => d.code === districtCode);
      return district ? district.name : districtCode;
    }
    return districtCode;
  };

  if (!user) {
    return <div>Please log in or register first</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white">
      <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-extrabold sm:text-5xl md:text-6xl">Member Dashboard</h1>
          <p className="mt-3 max-w-md mx-auto text-lg text-gray-400 sm:text-xl md:mt-5 md:max-w-3xl">Welcome back, {user.displayName}!</p>
        </div>

        <div className="bg-gray-800 shadow-2xl rounded-2xl p-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            <div className="flex items-center space-x-4">
              <FaIdCard className="text-3xl text-blue-400" />
              <div>
                <p className="text-sm text-gray-400">Member ID</p>
                <p className="text-xl font-bold">{user.memberId}</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <FaUser className="text-3xl text-blue-400" />
              <div>
                <p className="text-sm text-gray-400">Name</p>
                <p className="text-xl font-bold">{user.displayName}</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <FaEnvelope className="text-3xl text-blue-400" />
              <div>
                <p className="text-sm text-gray-400">Email</p>
                <p className="text-xl font-bold">{user.email}</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <FaPhone className="text-3xl text-blue-400" />
              <div>
                <p className="text-sm text-gray-400">Phone</p>
                <p className="text-xl font-bold">{user.phone}</p>
              </div>
            </div>
            <div className="flex items-center space-x-4 col-span-1 sm:col-span-2">
              <FaMapMarkerAlt className="text-3xl text-blue-400" />
              <div>
                <p className="text-sm text-gray-400">Location</p>
                <p className="text-xl font-bold">{user.area}, {getDistrictName(user.area, user.district)}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-6">
          <button 
            className="flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg transform hover:scale-105 transition-transform duration-300"
            onClick={() => navigate('/edit-profile')}
          >
            <FaUser className="mr-2" /> Edit Profile
          </button>
          <button 
            className="flex items-center justify-center bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-3 px-6 rounded-lg shadow-lg transform hover:scale-105 transition-transform duration-300"
            onClick={() => navigate('/reset-password')}
          >
            <FaKey className="mr-2" /> Change Password
          </button>
          <button 
            className="flex items-center justify-center bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-lg shadow-lg transform hover:scale-105 transition-transform duration-300"
            onClick={() => navigate('/')}
          >
            <FaPlus className="mr-2" /> Create Match
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
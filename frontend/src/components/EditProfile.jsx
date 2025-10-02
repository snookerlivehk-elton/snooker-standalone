import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { areaCodes } from '../lib/areaCodes.js';

const EditProfile = ({ user, onSave }) => {
  const [formData, setFormData] = useState({
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    area: user.area,
    district: user.district,
  });
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ ...user, ...formData });
    navigate('/dashboard');
  };

  return (
    <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4">Edit Profile</h2>
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-gray-700">Last Name</label>
          <input
            type="text"
            name="lastName"
            value={formData.lastName}
            onChange={handleChange}
            className="w-full px-3 py-2 border rounded"
          />
        </div>
        <div className="mb-4">
          <label className="block text-gray-700">First Name</label>
          <input
            type="text"
            name="firstName"
            value={formData.firstName}
            onChange={handleChange}
            className="w-full px-3 py-2 border rounded"
          />
        </div>
        <div className="mb-4">
          <label className="block text-gray-700">Phone</label>
          <input
            type="text"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            className="w-full px-3 py-2 border rounded"
          />
        </div>
        <div className="mb-4">
          <label className="block text-gray-700">Area</label>
          <select
            name="area"
            value={formData.area}
            onChange={(e) => setFormData({ ...formData, area: e.target.value, district: '' })}
            className="w-full px-3 py-2 border rounded bg-gray-200"
            disabled
          >
            <option value="">Please select an area</option>
            {Object.keys(areaCodes).map(area => (
              <option key={area} value={area}>{area}</option>
            ))}
          </select>
        </div>
        {formData.area && (
          <div className="mb-4">
            <label className="block text-gray-700">District</label>
            <select
              name="district"
              value={formData.district}
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded bg-gray-200"
              disabled
            >
              <option value="">Please select a district</option>
              {areaCodes[formData.area].map(district => (
                <option key={district.code} value={district.code}>{district.name}</option>
              ))}
            </select>
          </div>
        )}
        <div className="flex justify-between">
          <button type="button" onClick={() => navigate('/dashboard')} className="bg-gray-500 text-white py-2 px-4 rounded">Cancel</button>
          <button type="submit" className="bg-blue-500 text-white py-2 px-4 rounded">Save</button>
        </div>
      </form>
    </div>
  );
};

export default EditProfile;
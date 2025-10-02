import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { areaCodes } from '../lib/areaCodes.js';
import { generateMemberId } from '../lib/utils.js';

const Register = () => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    phone: '',
    area: '',
    district: '',
  });
  const [errors, setErrors] = useState({});
  const navigate = useNavigate();

  const validateStep1 = () => {
    const newErrors = {};
    if (!formData.email) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Invalid email format';
    if (!formData.password) newErrors.password = 'Password is required';
    else if (formData.password.length < 6) newErrors.password = 'Password must be at least 6 characters long';
    if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = 'Passwords do not match';
    return newErrors;
  };

  const validateStep2 = () => {
    const newErrors = {};
    if (!formData.firstName) newErrors.firstName = 'First name is required';
    if (!formData.lastName) newErrors.lastName = 'Last name is required';
    if (!formData.phone) newErrors.phone = 'Phone number is required';
    return newErrors;
  };

  const validateStep3 = () => {
    const newErrors = {};
    if (!formData.area) newErrors.area = 'Area is required';
    if (!formData.district) newErrors.district = 'District is required';
    return newErrors;
  };

  const handleNext = () => {
    let currentErrors = {};
    if (step === 1) currentErrors = validateStep1();
    if (step === 2) currentErrors = validateStep2();
    if (Object.keys(currentErrors).length === 0) {
      setStep(step + 1);
      setErrors({});
    } else {
      setErrors(currentErrors);
    }
  };

  const handleBack = () => {
    setStep(step - 1);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const currentErrors = validateStep3();
    if (Object.keys(currentErrors).length === 0) {
      const memberId = generateMemberId(formData.district);
      const userData = {
        ...formData,
        memberId,
        displayName: `${formData.lastName}${formData.firstName}`,
      };
      console.log('User Data:', userData);
      // Redirect to dashboard or show success message
      alert(`Registration successful! Your member ID is: ${memberId}`);
      navigate('/login');
    } else {
      setErrors(currentErrors);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const renderStep1 = () => (
    <div>
      <h2 className="text-2xl font-bold mb-4">Register as a Member</h2>
      <div className="mb-4">
        <label className="block text-gray-700">Email</label>
        <input
          type="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          className="w-full px-3 py-2 border rounded"
        />
        {errors.email && <p className="text-red-500 text-sm">{errors.email}</p>}
      </div>
      <div className="mb-4">
        <label className="block text-gray-700">Password</label>
        <input
          type="password"
          name="password"
          value={formData.password}
          onChange={handleChange}
          className="w-full px-3 py-2 border rounded"
        />
        {errors.password && <p className="text-red-500 text-sm">{errors.password}</p>}
      </div>
      <div className="mb-4">
        <label className="block text-gray-700">Confirm Password</label>
        <input
          type="password"
          name="confirmPassword"
          value={formData.confirmPassword}
          onChange={handleChange}
          className="w-full px-3 py-2 border rounded"
        />
        {errors.confirmPassword && <p className="text-red-500 text-sm">{errors.confirmPassword}</p>}
      </div>
      <button onClick={handleNext} className="w-full bg-blue-500 text-white py-2 rounded">Next</button>
      <p className="mt-4 text-center">
        Already have an account?{' '}
        <button onClick={() => navigate('/login')} className="text-blue-500 hover:underline">
          Login now
        </button>
      </p>
    </div>
  );

  const renderStep2 = () => (
    <div>
      <h2 className="text-2xl font-bold mb-4">Personal Information</h2>
      <div className="mb-4">
        <label className="block text-gray-700">Last Name</label>
        <input
          type="text"
          name="lastName"
          value={formData.lastName}
          onChange={handleChange}
          className="w-full px-3 py-2 border rounded"
        />
        {errors.lastName && <p className="text-red-500 text-sm">{errors.lastName}</p>}
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
        {errors.firstName && <p className="text-red-500 text-sm">{errors.firstName}</p>}
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
        {errors.phone && <p className="text-red-500 text-sm">{errors.phone}</p>}
      </div>
      <div className="flex justify-between">
        <button onClick={handleBack} className="bg-gray-500 text-white py-2 px-4 rounded">Back</button>
        <button onClick={handleNext} className="bg-blue-500 text-white py-2 px-4 rounded">Next</button>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div>
      <h2 className="text-2xl font-bold mb-4">Area Selection</h2>
      <div className="mb-4">
        <label className="block text-gray-700">Area</label>
        <select
          name="area"
          value={formData.area}
          onChange={(e) => setFormData({ ...formData, area: e.target.value, district: '' })}
          className="w-full px-3 py-2 border rounded"
        >
          <option value="">Please select an area</option>
          {Object.keys(areaCodes).map(area => (
            <option key={area} value={area}>{area}</option>
          ))}
        </select>
        {errors.area && <p className="text-red-500 text-sm">{errors.area}</p>}
      </div>
      {formData.area && (
        <div className="mb-4">
          <label className="block text-gray-700">District</label>
          <select
            name="district"
            value={formData.district}
            onChange={handleChange}
            className="w-full px-3 py-2 border rounded"
          >
            <option value="">Please select a district</option>
            {areaCodes[formData.area].map(district => (
              <option key={district.code} value={district.code}>{district.name}</option>
            ))}
          </select>
          {errors.district && <p className="text-red-500 text-sm">{errors.district}</p>}
        </div>
      )}
      {formData.district && (
        <div className="mb-4 p-4 bg-gray-100 rounded">
          <h3 className="text-lg font-semibold">Member ID Preview</h3>
          <p className="text-xl">{`${formData.district}XXXXXX`}</p>
        </div>
      )}
      <div className="flex justify-between">
        <button onClick={handleBack} className="bg-gray-500 text-white py-2 px-4 rounded">Back</button>
        <button onClick={handleSubmit} className="bg-green-500 text-white py-2 px-4 rounded">Register</button>
      </div>
    </div>
  );

  return (
    <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-lg shadow-md">
      {step === 1 && renderStep1()}
      {step === 2 && renderStep2()}
      {step === 3 && renderStep3()}
    </div>
  );
};

export default Register;
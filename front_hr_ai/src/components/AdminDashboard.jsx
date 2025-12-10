import React from 'react';
import { useNavigate } from 'react-router-dom';

function AdminDashboard({ user }) {
  const navigate = useNavigate();

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h3 className="text-xl font-bold mb-4">관리자 대시보드</h3>
      <p className="text-gray-600 mb-4">이곳에서 사용자 역할 및 권한을 관리할 수 있습니다.</p>
      <button 
        onClick={() => navigate('/admin')}
        className="bg-indigo-500 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded"
      >
        관리자 설정으로 이동
      </button>
    </div>
  );
}

export default AdminDashboard;

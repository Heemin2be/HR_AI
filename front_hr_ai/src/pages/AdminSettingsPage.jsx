import React from 'react';
import Sidebar from '../components/Sidebar';

function AdminSettingsPage() {
  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-grow p-8">
        <header className="mb-8">
            <h2 className="text-2xl font-bold">관리자 설정</h2>
            <p className="text-gray-500">이곳에서 사용자 역할, 팀 구성, 권한 등을 관리할 수 있습니다.</p>
        </header>
        <div>
            {/* Placeholder for admin settings UI */}
            <p>관리자 설정 UI가 여기에 표시됩니다.</p>
        </div>
      </main>
    </div>
  );
}

export default AdminSettingsPage;

import React, { useState } from "react";
import Sidebar from "../components/Sidebar";
import PersonalDashboard from "../components/PersonalDashboard";
import TeamDashboard from "../components/TeamDashboard";
import { useAuth } from "../contexts/AuthContext";

function DashboardPage() {
  const { currentUser } = useAuth();
  const [viewMode, setViewMode] = useState("default"); // 'default' (role based) or 'personal' (force personal view)

  // 안전장치: currentUser가 없을 경우
  if (!currentUser) {
    return <div>Loading...</div>;
  }

  const isTeamLeader = currentUser.role === "팀장";
  const showTeamDashboard = isTeamLeader && viewMode !== "personal";

  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-grow p-8">
        <header className="mb-8">
          <h2 className="text-2xl font-bold">
            안녕하세요, {currentUser.name}님!
          </h2>
          <p className="text-gray-500">
            {showTeamDashboard
              ? "팀 대시보드입니다. 팀원들의 현황을 확인하세요."
              : "개인 대시보드입니다. 본인의 업무를 기록하고 회고하세요."}
          </p>
        </header>

        {showTeamDashboard ? (
          <TeamDashboard
            user={currentUser}
            onToggleView={() => setViewMode("personal")}
          />
        ) : (
          <div>
            {isTeamLeader && (
              <button
                onClick={() => setViewMode("default")}
                className="mb-4 text-sm text-blue-600 hover:underline"
              >
                ← 팀 대시보드로 돌아가기
              </button>
            )}
            <PersonalDashboard user={currentUser} />
          </div>
        )}
      </main>
    </div>
  );
}

export default DashboardPage;

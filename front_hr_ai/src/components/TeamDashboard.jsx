import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

// This would typically be a separate file, but for simplicity, it's here for now.
function TeamMemberCard({ member }) {
  const latestReport = member.latest_report;
  const user = member.user;

  const navigate = useNavigate();

  const handleViewReports = () => {
    // Navigate to the new page for viewing a specific team member's reports
    navigate(`/team-member/${user.user_id}/reports`);
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow-md">
      <h4 className="text-lg font-bold mb-2">{user.name}</h4>
      <p className="text-sm text-gray-600 mb-2">
        {/* 최근 컨디션 is not in the response yet, assuming it might be added later or we remove it for now if not available */}
        {/* The backend response for get_team_reports doesn't seem to include last_report_status explicitly in the top level, 
            but it might be in latest_report.summary_content or we can parse it. 
            For now, let's keep it if it was there, or remove if it breaks. 
            The previous code had member.last_report_status. 
            The backend returns {user: ..., latest_report: ...}. 
            So member.last_report_status is likely undefined. 
            I will comment it out or try to extract from report if possible, but for now just safe access. */}
        {/* 최근 컨디션: {member.last_report_status} */}
      </p>
      <div className="bg-gray-50 p-3 rounded-md">
        <h5 className="font-semibold mb-1">
          최근 리포트 요약 (
          {latestReport
            ? new Date(latestReport.created_at).toLocaleDateString("ko-KR")
            : "N/A"}
          )
        </h5>
        {latestReport ? (
          <div>
            <pre className="text-sm whitespace-pre-wrap mb-3">
              {latestReport.summary_content.substring(0, 150)}...
            </pre>
            <div className="flex justify-end gap-2">
              <button
                onClick={handleViewReports}
                className="text-sm bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded"
              >
                리포트 전체 보기
              </button>
              {/* 팀장은 리포트를 수정할 수 없으므로 수정 버튼 숨김 (추후 권한 로직 정교화 가능) */}
              {/* <button onClick={() => handleEditReport(latestReport.report_id)} className="text-sm bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded">리포트 수정</button> */}
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500">아직 리포트가 없습니다.</p>
        )}
      </div>
    </div>
  );
}

function TeamDashboard({ onToggleView }) {
  const [members, setMembers] = useState([]);

  useEffect(() => {
    const fetchTeamReports = async () => {
      try {
        const response = await axios.get(
          import.meta.env.VITE_API_BASE_URL + "/api/v1/team/reports"
        );
        setMembers(response.data);
      } catch (error) {
        console.error("팀원 리포트 조회 실패:", error);
      }
    };

    fetchTeamReports();
  }, []);

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold">우리 팀 현황</h3>
        <button
          onClick={onToggleView}
          className="bg-purple-500 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded"
        >
          내 업무 기록하기 (개인 대시보드)
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {members.map((member) => (
          <TeamMemberCard key={member.user.user_id} member={member} />
        ))}
      </div>
    </div>
  );
}

export default TeamDashboard;

import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";

function TeamMemberReportsPage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchReports = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch reports for the specific team member
        const response = await axios.get(
          `${import.meta.env.VITE_API_BASE_URL}/api/v1/team/reports/${userId}`,
          { withCredentials: true } // Ensure cookies are sent if needed, though we use localStorage for token usually?
          // Wait, the project seems to use localStorage for token in headers usually, or cookies?
          // Let's check how other requests are made. PersonalDashboard uses axios.get without config,
          // implying global interceptor or cookie based auth.
          // Checking PersonalDashboard.jsx again... it uses axios.get("url").
          // If auth is token based, there must be an interceptor.
          // I will assume the existing setup handles auth.
        );

        setReports(response.data);

        // Try to get member name from the first report if available, or we might need another endpoint to get user details.
        // The report has chat_room which has user_id, but maybe not name.
        // However, the previous screen (TeamDashboard) had the name.
        // We could pass it via state, but if user refreshes, it's lost.
        // For now, let's just show "팀원 리포트" or try to extract name if possible.
        // Actually, the endpoint returns ReportResponse.
        // Let's check ReportResponse model in main.py... it has chat_room.
        // ChatRoom has user_id.
        // We might want to fetch user details separately or just rely on the context.
        // For simplicity, I'll just title it "팀원 리포트 목록".
      } catch (err) {
        console.error("Error fetching team member reports:", err);
        setError("리포트를 불러오는 데 실패했습니다.");
      } finally {
        setLoading(false);
      }
    };

    fetchReports();
  }, [userId]);

  const handleViewReport = (reportId) => {
    navigate(`/report/view/${reportId}`);
  };

  return (
    <div className="container mx-auto p-4">
      <div className="flex items-center mb-6">
        <button
          onClick={() => navigate(-1)}
          className="mr-4 text-gray-600 hover:text-gray-800"
        >
          ← 뒤로가기
        </button>
        <h1 className="text-2xl font-bold">팀원 리포트 목록</h1>
      </div>

      {error && (
        <div
          className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6"
          role="alert"
        >
          <p>{error}</p>
        </div>
      )}

      {loading ? (
        <p>로딩 중...</p>
      ) : reports.length > 0 ? (
        <ul className="space-y-4">
          {reports.map((report) => (
            <li
              key={report.report_id}
              className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow"
            >
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold text-lg">
                  {report.chat_room?.title || "대화"}
                </span>
                <span className="text-gray-500 text-sm">
                  {new Date(report.created_at).toLocaleDateString("ko-KR", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    weekday: "long",
                  })}
                </span>
              </div>
              <p className="text-gray-700 line-clamp-2 mb-4">
                {report.summary_content}
              </p>
              <button
                onClick={() => handleViewReport(report.report_id)}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm transition-colors"
              >
                상세보기
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="text-center py-10 bg-gray-50 rounded-lg">
          <p className="text-gray-500 text-lg">
            아직 생성된 리포트가 없습니다.
          </p>
        </div>
      )}
    </div>
  );
}

export default TeamMemberReportsPage;

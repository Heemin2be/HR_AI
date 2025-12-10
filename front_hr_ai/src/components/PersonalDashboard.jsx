import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

function PersonalDashboard({ user }) {
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [recentRoom, setRecentRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null); // Add error state

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null); // Clear previous errors

        const reportsPromise = axios.get(
          import.meta.env.VITE_API_BASE_URL + "/api/v1/reports"
        );
        const roomsPromise = axios.get(
          import.meta.env.VITE_API_BASE_URL + "/api/v1/chat_rooms"
        );

        const [reportsResponse, roomsResponse] = await Promise.all([
          reportsPromise,
          roomsPromise,
        ]);

        // Process reports
        const sortedReports = reportsResponse.data.sort(
          (a, b) => new Date(b.created_at) - new Date(a.created_at)
        );
        setReports(sortedReports.slice(0, 5));

        // Process chat rooms
        if (roomsResponse.data && roomsResponse.data.length > 0) {
          // The backend already sorts rooms by created_at desc
          setRecentRoom(roomsResponse.data[0]);
        }
      } catch (err) {
        console.error("Error fetching dashboard data:", err);
        setError(
          "대시보드 데이터를 불러오는 데 실패했습니다. 서버가 실행 중인지 확인해주세요."
        ); // Set user-friendly error
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleStartChat = () => {
    if (recentRoom) {
      navigate(`/chat/${recentRoom.room_id}`);
    } else {
      // If there are no rooms, the user should use the sidebar to create one.
      alert("사이드바에서 '새 대화 시작'을 눌러 첫 대화를 시작해주세요.");
    }
  };

  const handleViewReport = (reportId) => {
    navigate(`/report/view/${reportId}`);
  };

  return (
    <div>
      <div
        className="bg-blue-100 border-l-4 border-blue-500 text-blue-700 p-4 mb-6"
        role="alert"
      >
        <h3 className="font-bold">"{user.name}님, 오늘 하루도 힘내세요!"</h3>
        <p>AI 챗봇과 대화하며 하루를 기록하고, 편하게 회고를 남겨보세요.</p>
        <button
          onClick={handleStartChat}
          className="mt-2 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
          최근 대화 이어하기
        </button>
      </div>

      {error && ( // Display error message if present
        <div
          className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6"
          role="alert"
        >
          <p className="font-bold">오류 발생:</p>
          <p>{error}</p>
        </div>
      )}

      <div>
        <h3 className="text-xl font-bold mb-4">최근 리포트 목록 (최대 5개)</h3>
        {loading ? (
          <p>리포트를 불러오는 중...</p>
        ) : reports.length > 0 ? (
          <ul className="space-y-2">
            {reports.map((report) => (
              <li
                key={report.report_id}
                className="bg-white p-4 rounded-lg shadow-md flex justify-between items-center"
              >
                <span>
                  <span className="font-semibold mr-2">
                    {report.chat_room?.title || "대화"}
                  </span>
                  <span className="text-gray-500 text-sm">
                    ({new Date(report.created_at).toLocaleDateString("ko-KR")})
                  </span>
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleViewReport(report.report_id)}
                    className="text-sm bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded"
                  >
                    상세보기
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500">아직 생성된 리포트가 없습니다.</p>
        )}
        <button
          onClick={() => navigate("/my-reports")}
          className="mt-4 text-sm text-blue-600 hover:underline"
        >
          모든 리포트 보기 →
        </button>
      </div>
    </div>
  );
}

export default PersonalDashboard;

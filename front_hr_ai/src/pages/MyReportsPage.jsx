import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import Sidebar from "../components/Sidebar";

function MyReportsPage() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchReports = async () => {
      try {
        setLoading(true);
        const response = await axios.get(
          import.meta.env.VITE_API_BASE_URL + "/api/v1/reports"
        );
        setReports(response.data);
        setLoading(false);
      } catch (err) {
        setError("리포트를 불러오는 데 실패했습니다.");
        console.error("Error fetching reports:", err);
        setLoading(false);
      }
    };

    fetchReports();
  }, []);

  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-grow p-8">
        <header className="mb-8">
          <h2 className="text-2xl font-bold">내 리포트 목록</h2>
          <p className="text-gray-500">AI가 생성한 나의 일일 리포트입니다.</p>
        </header>

        {loading ? (
          <p>리포트를 불러오는 중...</p>
        ) : error ? (
          <p className="text-red-500">{error}</p>
        ) : reports.length > 0 ? (
          <ul className="space-y-4">
            {reports.map((report) => (
              <li
                key={report.report_id}
                className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow"
              >
                <Link to={`/report/view/${report.report_id}`} className="block">
                  <h3 className="text-lg font-semibold text-blue-600 hover:underline">
                    {new Date(report.created_at).toLocaleDateString("ko-KR")}{" "}
                    리포트
                  </h3>
                  <p className="text-gray-600 mt-2 truncate">
                    {report.summary_content.split("\n")[1] ||
                      "내용 미리보기..."}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p>생성된 리포트가 없습니다.</p>
        )}
      </main>
    </div>
  );
}

export default MyReportsPage;

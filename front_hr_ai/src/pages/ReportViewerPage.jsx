import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import Sidebar from "../components/Sidebar";
import ReactMarkdown from "react-markdown";

import { useAuth } from "../contexts/AuthContext";

function ReportViewerPage() {
  const { currentUser } = useAuth();
  const { reportId } = useParams();
  // const navigate = useNavigate(); // Unused
  const [report, setReport] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copySuccess, setCopySuccess] = useState("");

  useEffect(() => {
    const fetchReportDetails = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await axios.get(
          `${import.meta.env.VITE_API_BASE_URL}/api/v1/reports/${reportId}`
        );
        setReport(response.data.report);
        setMessages(response.data.messages);
        setLoading(false);
      } catch (err) {
        setError("리포트 상세 정보를 불러오는 데 실패했습니다.");
        console.error("Error fetching report details:", err);
        setLoading(false);
      }
    };

    fetchReportDetails();
  }, [reportId]);

  const copyToClipboard = () => {
    if (report && report.summary_content) {
      navigator.clipboard
        .writeText(report.summary_content)
        .then(() => {
          setCopySuccess("복사됨!");
          setTimeout(() => setCopySuccess(""), 2000);
        })
        .catch((err) => {
          setCopySuccess("실패");
          console.error("클립보드 복사 실패: ", err);
        });
    }
  };

  const mainContent = () => {
    if (loading) {
      return <p>리포트 상세 정보를 불러오는 중...</p>;
    }

    if (error) {
      return <p className="text-red-500">{error}</p>;
    }

    if (!report) {
      return <p>리포트를 찾을 수 없습니다.</p>;
    }

    // 프라이버시 보호 로직:
    // 팀장(currentUser.role === '팀장')이면서, 본인의 리포트가 아닌 경우(report.chat_room.user_id !== currentUser.id)
    // 원본 대화 내용을 숨깁니다.
    // 주의: report.chat_room.user_id가 없을 경우를 대비해 안전하게 접근해야 합니다.
    const isTeamLeader = currentUser && currentUser.role === "팀장";
    const isOwnReport =
      currentUser &&
      report.chat_room &&
      report.chat_room.user_id === currentUser.id;
    const showRawConversation = !isTeamLeader || isOwnReport;

    return (
      <>
        <header className="mb-8">
          <h2 className="text-2xl font-bold">리포트 상세 보기</h2>
          <p className="text-gray-500">
            {new Date(report.created_at).toLocaleString("ko-KR")} 에 생성된
            리포트입니다.
          </p>
        </header>
        <div
          className={`grid grid-cols-1 ${
            showRawConversation ? "lg:grid-cols-2" : ""
          } gap-8`}
        >
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-xl font-bold mb-4 flex justify-between items-center">
              요약
              <button
                onClick={copyToClipboard}
                className="text-sm bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded"
              >
                {copySuccess || "복사"}
              </button>
            </h3>
            <div className="space-y-4">
              <ReactMarkdown
                components={{
                  h2: ({ ...props }) => (
                    <h2
                      className="text-xl font-bold text-gray-800 border-b-2 border-gray-200 pb-2 mb-4 mt-6 first:mt-0"
                      {...props}
                    />
                  ),
                  ul: ({ ...props }) => (
                    <ul
                      className="list-disc list-inside space-y-2 pl-2"
                      {...props}
                    />
                  ),
                  li: ({ ...props }) => (
                    <li className="text-gray-700 leading-relaxed" {...props} />
                  ),
                  p: ({ ...props }) => (
                    <p className="text-gray-600 mb-2" {...props} />
                  ),
                }}
              >
                {report.summary_content}
              </ReactMarkdown>
            </div>
          </div>

          {showRawConversation && (
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-xl font-bold mb-4">원본 대화</h3>
              <div className="space-y-4 h-[60vh] overflow-y-auto pr-4">
                {messages.map((msg, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg ${
                      msg.sender === "user" ? "bg-blue-100" : "bg-gray-100"
                    }`}
                  >
                    <span className="font-bold">
                      {msg.sender === "user" ? "나" : "AI"}:
                    </span>{" "}
                    {msg.content}
                    <div className="text-xs text-gray-500 mt-1 text-right">
                      {new Date(msg.created_at).toLocaleTimeString("ko-KR")}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </>
    );
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      <main className="flex-grow p-8 overflow-y-auto">{mainContent()}</main>
    </div>
  );
}

export default ReportViewerPage;

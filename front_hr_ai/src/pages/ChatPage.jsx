import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useNavigate, useParams } from "react-router-dom";
import Sidebar from "../components/Sidebar";

function ChatPage() {
  const { roomId } = useParams();
  const navigate = useNavigate();

  const [chatRoom, setChatRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");

  const [isLoadingRoom, setIsLoadingRoom] = useState(true);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  const [reportStatus, setReportStatus] = useState({}); // New state for report status
  const [isTooltipVisible, setIsTooltipVisible] = useState(false); // New state for tooltip visibility

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null); // Ref for textarea

  useEffect(() => {
    const fetchChatRoomDetails = async () => {
      if (!roomId) return;
      setIsLoadingRoom(true);
      try {
        const response = await axios.get(
          `${import.meta.env.VITE_API_BASE_URL}/api/v1/chat_rooms/${roomId}`
        );
        setChatRoom(response.data);
        setMessages(
          response.data.messages.map((msg) => ({ ...msg, text: msg.content }))
        );
        setReportStatus(response.data.report_status); // Initialize report status
      } catch (error) {
        console.error("채팅방 정보를 불러오는 데 실패했습니다.", error);
        navigate("/");
      } finally {
        setIsLoadingRoom(false);
      }
    };

    fetchChatRoomDetails();
  }, [roomId, navigate]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (input.trim() && roomId) {
      const userMessage = {
        text: input,
        sender: "user",
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMessage]);
      setInput("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto"; // Reset height
      }
      setIsSendingMessage(true);

      try {
        const response = await axios.post(
          `${
            import.meta.env.VITE_API_BASE_URL
          }/api/v1/chat_rooms/${roomId}/messages`,
          {
            prompt: input,
          }
        );
        const aiMessage = {
          ...response.data.message,
          text: response.data.message.content,
        };
        setMessages((prev) => [...prev, aiMessage]);
        setReportStatus(response.data.report_status); // Update report status from backend
      } catch (error) {
        console.error("Error sending message:", error);
        setMessages((prev) => [
          ...prev,
          {
            text: "AI 응답을 받는데 실패했습니다.",
            sender: "ai",
            created_at: new Date().toISOString(),
          },
        ]);
      } finally {
        setIsSendingMessage(false);
      }
    }
  };

  const handleGenerateReport = async () => {
    if (!roomId) return;
    setIsGeneratingReport(true);
    try {
      const response = await axios.post(
        `${
          import.meta.env.VITE_API_BASE_URL
        }/api/v1/chat_rooms/${roomId}/reports`
      );
      alert("리포트가 성공적으로 생성되었습니다!");

      // Update chat room title if returned and set has_report to true
      if (response.data.room_title) {
        setChatRoom((prev) => ({
          ...prev,
          title: response.data.room_title,
          has_report: true,
        }));
      } else {
        setChatRoom((prev) => ({ ...prev, has_report: true }));
      }

      navigate(`/report/view/${response.data.report_id}`);
    } catch (error) {
      console.error("Error generating report:", error);
      const errorData = error.response?.data?.detail;
      let errorMessage = "리포트 생성에 실패했습니다.";
      if (typeof errorData === "object" && errorData.message) {
        errorMessage = `${errorData.message}\n- ${errorData.missing_fields.join(
          "\n- "
        )}`;
      } else if (typeof errorData === "string") {
        errorMessage = errorData;
      }
      alert(errorMessage);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const isReportButtonEnabled =
    !chatRoom?.has_report &&
    Object.values(reportStatus).every((status) => status === "sufficient");

  const isLoading = isLoadingRoom || isSendingMessage || isGeneratingReport;

  const tooltipContent = (
    <div className="p-2 text-xs bg-gray-800 text-white rounded-lg shadow-lg w-64">
      {chatRoom?.has_report ? (
        <p className="mb-1 text-yellow-400">이미 리포트가 생성되었습니다.</p>
      ) : (
        <>
          <p className="mb-1">아직 리포트 생성을 위한 대화가 부족합니다!</p>
          {Object.entries(reportStatus).map(([category, status]) => (
            <p
              key={category}
              className={
                status === "missing" ? "text-red-400" : "text-green-400"
              }
            >
              {category}: {status === "missing" ? "부족" : "충분"}
            </p>
          ))}
        </>
      )}
    </div>
  );

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      <main className="flex-grow flex flex-col">
        {isLoadingRoom ? (
          <div className="flex justify-center items-center h-full">
            <p>채팅방을 불러오는 중...</p>
          </div>
        ) : (
          <>
            <header className="bg-white p-4 border-b font-bold text-lg">
              {chatRoom?.title || "대화"}
            </header>
            <div className="flex-grow p-6 overflow-auto">
              <div className="flex flex-col gap-4">
                {messages.map((msg, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg max-w-xl shadow-md ${
                      msg.sender === "ai"
                        ? "bg-white self-start"
                        : "bg-blue-500 text-white self-end"
                    }`}
                  >
                    {msg.text}
                    <div className="text-xs mt-1 text-right opacity-70">
                      {new Date(msg.created_at).toLocaleTimeString("ko-KR")}
                    </div>
                  </div>
                ))}
                {isSendingMessage && (
                  <div className="p-3 rounded-lg max-w-lg bg-white self-start flex items-center shadow-md">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900 mr-3"></div>
                    AI가 응답을 생각하고 있어요...
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>
            <footer className="p-4 bg-white border-t">
              <div className="flex gap-2 items-center">
                <textarea
                  ref={textareaRef}
                  className="flex-grow p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 transition resize-none overflow-hidden"
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    // Auto-resize logic
                    e.target.style.height = "auto";
                    const newHeight = Math.min(e.target.scrollHeight, 120);
                    e.target.style.height = `${newHeight}px`;

                    // Toggle scrollbar
                    if (e.target.scrollHeight > 120) {
                      e.target.style.overflowY = "auto";
                    } else {
                      e.target.style.overflowY = "hidden";
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && !isLoading) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder="AI에게 메시지를 보내세요..."
                  disabled={isLoading}
                  rows={1}
                  style={{ maxHeight: "120px" }}
                />
                <button
                  onClick={sendMessage}
                  disabled={isLoading}
                  className="px-6 py-3 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 disabled:bg-gray-400 transition"
                >
                  전송
                </button>
                <div
                  className="relative"
                  onMouseEnter={() => setIsTooltipVisible(true)}
                  onMouseLeave={() => setIsTooltipVisible(false)}
                >
                  <button
                    onClick={handleGenerateReport}
                    disabled={isLoading || !isReportButtonEnabled}
                    className={`px-6 py-3 text-white rounded-lg font-semibold transition ${
                      isReportButtonEnabled
                        ? "bg-green-500 hover:bg-green-600"
                        : "bg-gray-400 cursor-not-allowed"
                    }`}
                  >
                    {isGeneratingReport ? "생성 중..." : "리포트 생성"}
                  </button>
                  {!isReportButtonEnabled && isTooltipVisible && (
                    <div className="absolute bottom-full right-0 mb-2">
                      {tooltipContent}
                    </div>
                  )}
                </div>
              </div>
            </footer>
          </>
        )}
      </main>
    </div>
  );
}

export default ChatPage;

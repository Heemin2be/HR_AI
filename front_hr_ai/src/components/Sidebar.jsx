import React, { useState, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import axios from "axios";

function Sidebar() {
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();
  const [chatRooms, setChatRooms] = useState([]);
  const [editingRoomId, setEditingRoomId] = useState(null);
  const [editTitle, setEditTitle] = useState("");

  const fetchChatRooms = async () => {
    try {
      // Assuming user is logged in, otherwise this component might not be rendered
      const response = await axios.get(
        import.meta.env.VITE_API_BASE_URL + "/api/v1/chat_rooms"
      );
      setChatRooms(response.data);
    } catch (error) {
      console.error("채팅방 목록을 불러오는 데 실패했습니다.", error);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchChatRooms();
    }
  }, [currentUser]);

  const handleNewChat = async () => {
    try {
      const response = await axios.post(
        import.meta.env.VITE_API_BASE_URL + "/api/v1/chat_rooms"
      );
      const newRoom = response.data;
      await fetchChatRooms(); // Refresh the list
      navigate(`/chat/${newRoom.room_id}`);
    } catch (error) {
      console.error("새 채팅방을 만드는 데 실패했습니다.", error);
    }
  };

  const handleDeleteChat = async (e, roomId) => {
    e.preventDefault(); // Prevent navigation
    e.stopPropagation(); // Stop event bubbling

    if (
      window.confirm(
        "정말로 이 대화를 삭제하시겠습니까? 삭제된 대화는 복구할 수 없습니다."
      )
    ) {
      try {
        await axios.delete(
          `${import.meta.env.VITE_API_BASE_URL}/api/v1/chat_rooms/${roomId}`
        );
        await fetchChatRooms(); // Refresh list

        // If we are currently in the deleted room, navigate away
        if (window.location.pathname === `/chat/${roomId}`) {
          navigate("/");
        }
      } catch (error) {
        console.error("채팅방 삭제 실패:", error);
        alert("채팅방 삭제 중 오류가 발생했습니다.");
      }
    }
  };

  const startEditing = (e, room) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingRoomId(room.room_id);
    setEditTitle(room.title);
  };

  const cancelEditing = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setEditingRoomId(null);
    setEditTitle("");
  };

  const handleUpdateTitle = async (e, roomId) => {
    e.preventDefault();
    e.stopPropagation();

    if (!editTitle.trim()) {
      alert("제목을 입력해주세요.");
      return;
    }

    try {
      await axios.put(
        `${import.meta.env.VITE_API_BASE_URL}/api/v1/chat_rooms/${roomId}`,
        {
          title: editTitle,
        }
      );
      await fetchChatRooms();
      setEditingRoomId(null);
      setEditTitle("");
    } catch (error) {
      console.error("채팅방 제목 수정 실패:", error);
      alert("제목 수정 중 오류가 발생했습니다.");
    }
  };

  const handleKeyDown = (e, roomId) => {
    if (e.key === "Enter") {
      handleUpdateTitle(e, roomId);
    } else if (e.key === "Escape") {
      cancelEditing(e);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const navLinkClasses = "block py-2 px-4 rounded hover:bg-gray-700 text-sm";
  const activeNavLinkClasses = "bg-gray-700";

  return (
    <aside className="w-64 h-screen bg-gray-800 text-white flex flex-col flex-shrink-0">
      <div className="p-4 border-b border-gray-700">
        <div
          onClick={() => navigate("/")}
          className="flex items-center cursor-pointer space-x-2"
        >
          <img
            src="/logo.png"
            alt="HR-AI Logo"
            className="w-8 h-8 rounded-full"
          />
          <h1 className="text-2xl font-bold">HR-AI</h1>
        </div>
      </div>

      <div className="p-4">
        <button
          onClick={handleNewChat}
          className="w-full bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 transition-colors"
        >
          + 새 대화 시작
        </button>
      </div>

      <nav className="flex-grow p-4 overflow-y-auto">
        <p className="px-4 pb-2 text-xs text-gray-400 font-semibold uppercase">
          대화 목록
        </p>
        {chatRooms.map((room) => (
          <NavLink
            key={room.room_id}
            to={`/chat/${room.room_id}`}
            className={({ isActive }) =>
              `${navLinkClasses} ${
                isActive ? activeNavLinkClasses : ""
              } flex justify-between items-center group`
            }
            title={room.title}
          >
            {editingRoomId === room.room_id ? (
              <div
                className="flex-grow mr-2"
                onClick={(e) => e.preventDefault()}
              >
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, room.room_id)}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full bg-gray-700 text-white px-2 py-1 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  autoFocus
                  onBlur={() => cancelEditing()}
                />
              </div>
            ) : (
              <span className="truncate flex-grow">{room.title}</span>
            )}

            <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
              {editingRoomId !== room.room_id && (
                <button
                  onClick={(e) => startEditing(e, room)}
                  className="ml-2 text-gray-400 hover:text-blue-400 focus:outline-none"
                  title="제목 수정"
                >
                  ✎
                </button>
              )}
              <button
                onClick={(e) => handleDeleteChat(e, room.room_id)}
                className="ml-2 text-gray-400 hover:text-red-500 focus:outline-none"
                title="대화 삭제"
              >
                ✕
              </button>
            </div>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-700">
        {currentUser ? (
          <>
            <div className="mb-4">
              <span className="font-bold">{currentUser.name}</span> (
              {currentUser.role})
            </div>
            <button
              onClick={handleLogout}
              className="w-full text-left bg-red-500 text-white py-2 px-4 rounded hover:bg-red-600 transition-colors"
            >
              로그아웃
            </button>
          </>
        ) : (
          <button
            onClick={() => navigate("/login")}
            className="w-full text-left py-2 px-4 rounded hover:bg-gray-700"
          >
            로그인
          </button>
        )}
      </div>
    </aside>
  );
}

export default Sidebar;

import React, { createContext, useState, useContext, useEffect } from "react";
import axios from "axios";

// 1. Create the context
const AuthContext = createContext();

// 2. Create the provider component
export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Initialize user from localStorage on app start
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    const token = localStorage.getItem("token");
    if (storedUser && token) {
      setCurrentUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  // Axios interceptor to attach token to every request
  useEffect(() => {
    const requestInterceptor = axios.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem("token");
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        // Bypass ngrok browser warning for all requests
        config.headers["ngrok-skip-browser-warning"] = "69420";
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    const responseInterceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response && error.response.status === 401) {
          // Token expired or invalid
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          setCurrentUser(null);
          // Optional: Redirect to login if not already handled by state change
          // window.location.href = "/login";
        }
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.request.eject(requestInterceptor);
      axios.interceptors.response.eject(responseInterceptor);
    };
  }, []);

  // Login function
  const login = async (username, password) => {
    try {
      // Use FormData for OAuth2PasswordRequestForm
      const formData = new FormData();
      formData.append("username", username);
      formData.append("password", password);

      const response = await axios.post(
        import.meta.env.VITE_API_BASE_URL + "/api/v1/login",
        formData
      );

      const {
        access_token,
        user_id,
        role,
        username: returnedUsername,
      } = response.data;

      const user = {
        id: user_id,
        username: returnedUsername,
        role: role,
        name: role === "팀장" ? "박팀장" : "김팀원", // 임시: 이름은 DB에 없으므로 역할 기반으로 매핑 (추후 DB에 name 추가 필요)
        team_id: 101, // 임시
      };

      // Save to localStorage
      localStorage.setItem("token", access_token);
      localStorage.setItem("user", JSON.stringify(user));

      setCurrentUser(user);
      return true;
    } catch (error) {
      console.error("Login failed:", error);
      return false;
    }
  };

  // Logout function
  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setCurrentUser(null);
  };

  const value = {
    currentUser,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

// 3. Create a custom hook for easy consumption
export function useAuth() {
  return useContext(AuthContext);
}

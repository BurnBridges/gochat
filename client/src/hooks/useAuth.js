import { useState, useEffect } from "react";
import { API } from "../utils/api";

export function useAuth() {
  const [user, setUser] = useState(null);
  const [isAuth, setIsAuth] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const userId = localStorage.getItem("userId");
    const username = localStorage.getItem("username");

    if (token && userId) {
      setUser({ userId, username });
      setIsAuth(true);
    }
  }, []);

  return { user, setUser, isAuth, setIsAuth };
}
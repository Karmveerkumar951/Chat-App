import React, { useState } from "react";
import Login from "./components/Login";
import Chat from "./components/Chat";

export default function App() {
  const [user, setUser] = useState(() => {
    const s = localStorage.getItem("user");
    return s ? JSON.parse(s) : null;
  });

  return (
    <div>
      {user ? (
        <Chat user={user} onLogout={() => { localStorage.removeItem("user"); setUser(null); }} />
      ) : (
        <Login onLogin={(u) => { localStorage.setItem("user", JSON.stringify(u)); setUser(u); }} />
      )}
    </div>
  );
}

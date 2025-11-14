import React, { useState } from "react";

export default function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState("login");

  async function submit(e) {
    e.preventDefault();
    const url = mode === "login" ? "/api/login" : "/api/register";
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (res.ok) {
      if (mode === "login") {
        onLogin({ id: data.user.id, username: data.user.username, token: data.access_token });
      } else {
        alert("Registered! Please login.");
        setMode("login");
      }
    } else {
      alert(data.detail || JSON.stringify(data));
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>{mode === "login" ? "Login" : "Register"}</h2>
      <form onSubmit={submit}>
        <div><input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="username" /></div>
        <div><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="password" /></div>
        <button type="submit">{mode === "login" ? "Login" : "Register"}</button>
      </form>
      <button onClick={() => setMode(mode === "login" ? "register" : "login")}>
        {mode === "login" ? "Go to Register" : "Go to Login"}
      </button>
    </div>
  );
}

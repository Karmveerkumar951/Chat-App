import React, { useState, useEffect, useRef } from "react";

export default function Chat({ user, onLogout }) {
  const [ws, setWs] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [peer, setPeer] = useState("");
  const [searchResults, setSearchResults] = useState([]);

  const msgsRef = useRef(null);

  // -------------------------------------------
  // OPEN WEBSOCKET ONLY ONE TIME
  // -------------------------------------------
  useEffect(() => {
    fetch(`/api/conversations/${user.id}`)
      .then((r) => r.json())
      .then(setConversations);

    const socket = new WebSocket(`ws://localhost:8000/ws/${user.token}`);

    socket.onopen = () => console.log("WS CONNECTED!");
    socket.onclose = () => console.log("WS CLOSED!");
    socket.onerror = (err) => console.log("WS ERROR:", err);

    socket.onmessage = (ev) => {
      console.log("WS RECEIVED:", ev.data);
      const data = JSON.parse(ev.data);

      // ----------------------------
      // NEW CHAT AUTO OPEN
      // ----------------------------
      if (!activeConv) {
        console.log("NEW CHAT DETECTED → AUTO OPENING...");
        setActiveConv(data.conversation_id);

        fetch(`/api/messages/${data.conversation_id}`)
          .then((r) => r.json())
          .then((msgs) => {
            setMessages(msgs);
            scrollBottom();
          });

        fetch(`/api/conversations/${user.id}`)
          .then((r) => r.json())
          .then(setConversations);

        return;
      }

      // ----------------------------
      // MESSAGE FOR CURRENT CHAT
      // ----------------------------
      if (String(data.conversation_id) === String(activeConv)) {
        fetch(`/api/messages/${activeConv}`)
          .then((r) => r.json())
          .then((msgs) => {
            setMessages(msgs);
            scrollBottom();
          });
      }

      // Always refresh conversation list
      fetch(`/api/conversations/${user.id}`)
        .then((r) => r.json())
        .then(setConversations);
    };

    setWs(socket);

    return () => socket.close();
  }, [user]);

  // -------------------------------------------
  // USERNAME SEARCH FUNCTION
  // -------------------------------------------
  async function handleSearch(query) {
    setPeer(query);

    if (query.trim().length === 0) {
      setSearchResults([]);
      return;
    }

    const res = await fetch(`/api/search-users?q=${query}`);
    const users = await res.json();

    // Exclude the current logged-in user
    const filtered = users.filter((u) => u.id !== user.id);
    setSearchResults(filtered);
  }

  // -------------------------------------------
  // START CHAT WITH A USER FROM SEARCH
  // -------------------------------------------
  function startChatWithUser(u) {
    setPeer(u.id);
    setSearchResults([]);

    const payload = {
      to: Number(u.id),
      conversation_id: null,
      content: "Hi",
    };

    console.log("WS STARTING CHAT WITH:", u);
    ws.send(JSON.stringify(payload));
  }

  // -------------------------------------------
  // OPEN EXISTING CONVERSATION
  // -------------------------------------------
  async function openConversation(conv) {
    setActiveConv(conv.id);

    const res = await fetch(`/api/messages/${conv.id}`);
    const data = await res.json();
    setMessages(data);

    setPeer(conv.user_a === user.id ? conv.user_b : conv.user_a);

    setTimeout(scrollBottom, 100);
  }

  // -------------------------------------------
  // SCROLL TO BOTTOM
  // -------------------------------------------
  function scrollBottom() {
    if (msgsRef.current)
      msgsRef.current.scrollTop = msgsRef.current.scrollHeight;
  }

  // -------------------------------------------
  // SEND MESSAGE
  // -------------------------------------------
  function sendMessage(e) {
    e.preventDefault();
    if (!ws) {
      console.log("WS NOT READY!");
      return;
    }

    const payload = {
      to: Number(peer),
      conversation_id: activeConv,
      content: input,
    };

    console.log("WS SENDING:", payload);
    ws.send(JSON.stringify(payload));

    // Optimistic UI
    setMessages((prev) => [
      ...prev,
      {
        conversation_id: activeConv,
        sender_id: user.id,
        content: input,
        timestamp: new Date().toISOString(),
      },
    ]);

    setInput("");
    scrollBottom();
  }

  return (
    <div className="app">
      {/* ---------------------- SIDEBAR ---------------------- */}
      <div className="sidebar">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <strong>{user.username}</strong>
          <button onClick={onLogout}>Logout</button>
        </div>

        <hr />

        {/* Search bar */}
        <div>
          <input
            placeholder="Search username..."
            value={peer}
            onChange={(e) => handleSearch(e.target.value)}
          />

          {/* Search results dropdown */}
          {searchResults.length > 0 && (
            <div style={{ background: "#fff", border: "1px solid #ccc", marginTop: 4 }}>
              {searchResults.map((u) => (
                <div
                  key={u.id}
                  style={{ padding: 6, cursor: "pointer" }}
                  onClick={() => startChatWithUser(u)}
                >
                  {u.username}
                </div>
              ))}
            </div>
          )}
        </div>

        <h4>Conversations</h4>

        {/* Conversation list */}
        <div>
          {conversations.map((c) => (
            <div
              key={c.id}
              style={{ padding: "6px", cursor: "pointer" }}
              onClick={() => openConversation(c)}
            >
              <div>
                Conv {c.id} — {c.user_a} & {c.user_b}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ---------------------- CHAT WINDOW ---------------------- */}
      <div className="chat">
        <div style={{ padding: 8, borderBottom: "1px solid #ddd" }}>
          Chat — {activeConv || "No conversation"}
        </div>

        <div className="messages" ref={msgsRef}>
          {messages.map((m, i) => (
            <div
              key={i}
              className={"msg " + (m.sender_id === user.id ? "me" : "you")}
            >
              <div style={{ fontSize: 12, opacity: 0.7 }}>{m.sender_id}</div>
              <div>{m.content}</div>
              <div style={{ fontSize: 11, opacity: 0.6 }}>{m.timestamp}</div>
            </div>
          ))}
        </div>

        <form className="input" onSubmit={sendMessage}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            style={{ width: "80%" }}
          />
          <button type="submit">Send</button>
        </form>
      </div>
    </div>
  );
}

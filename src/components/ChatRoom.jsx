import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, Hash, Users, RefreshCw, Plus, X, UserPlus, FolderPlus } from 'lucide-react';

export default function ChatRoom({ currentUser }) {
  const [channels, setChannels] = useState([]);
  const [activeChannel, setActiveChannel] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Lists for contact selections
  const [staffList, setStaffList] = useState([]);
  const [staffMap, setStaffMap] = useState({}); // name -> role

  // Modal states
  const [showDmModal, setShowDmModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedGroupMembers, setSelectedGroupMembers] = useState([]);

  // Unread status map (channelId -> unreadCount)
  const [unreadMap, setUnreadMap] = useState({});

  const messagesEndRef = useRef(null);

  // Fetch staff list on mount
  useEffect(() => {
    fetch('/api/staff')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setStaffList(data);
          const map = {};
          data.forEach(s => {
            map[s.name] = s.role;
          });
          setStaffMap(map);
        }
      })
      .catch(err => console.error("Error loading staff:", err));
  }, []);

  // Fetch channels list
  const fetchChannels = (silent = false) => {
    if (!currentUser?.id) return;
    fetch(`/api/chat/channels?staff_id=${currentUser.id}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setChannels(data);
          
          // Auto-select first channel on initial load
          if (!activeChannel && data.length > 0) {
            setActiveChannel(data[0]);
          }

          // Calculate unread counts
          const newUnreads = {};
          let totalGlobalUnread = 0;
          data.forEach(c => {
            const lastRead = Number(localStorage.getItem(`chat_last_read_${currentUser.id}_${c.id}`) || 0);
            if (c.last_message_id && c.last_message_id > lastRead) {
              // Mark as unread
              newUnreads[c.id] = true;
              if (!activeChannel || activeChannel.id !== c.id) {
                totalGlobalUnread++;
              }
            }
          });
          setUnreadMap(newUnreads);

          // Dispatch event to main navigation shell
          window.dispatchEvent(new CustomEvent('chat-unread-updated', { detail: totalGlobalUnread }));
        }
      })
      .catch(err => console.error("Error fetching channels:", err));
  };

  // Poll channels and active messages
  useEffect(() => {
    fetchChannels(false);
    const interval = setInterval(() => {
      fetchChannels(true);
    }, 3000);
    return () => clearInterval(interval);
  }, [currentUser, activeChannel]);

  // Fetch messages when active channel changes
  const fetchMessages = (silent = false) => {
    if (!activeChannel) return;
    if (!silent) setIsLoading(true);
    fetch(`/api/chat/messages/${activeChannel.id}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setMessages(data);
          
          // Mark this channel as read
          if (data.length > 0) {
            const maxId = Math.max(...data.map(m => m.id));
            localStorage.setItem(`chat_last_read_${currentUser.id}_${activeChannel.id}`, maxId.toString());
            
            // Instantly clear unread dot
            setUnreadMap(prev => {
              const updated = { ...prev };
              delete updated[activeChannel.id];
              
              // Recalculate global unread count
              let count = 0;
              channels.forEach(c => {
                if (c.id !== activeChannel.id && updated[c.id]) {
                  count++;
                }
              });
              window.dispatchEvent(new CustomEvent('chat-unread-updated', { detail: count }));
              return updated;
            });
          }
        }
      })
      .catch(err => console.error("Error loading messages:", err))
      .finally(() => {
        if (!silent) setIsLoading(false);
      });
  };

  useEffect(() => {
    fetchMessages(false);
    const interval = setInterval(() => {
      fetchMessages(true);
    }, 3000);
    return () => clearInterval(interval);
  }, [activeChannel]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputText.trim() || !activeChannel) return;

    const payload = {
      sender_id: currentUser.id,
      sender_name: currentUser.name,
      message_text: inputText.trim()
    };

    fetch(`/api/chat/messages/${activeChannel.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(res => res.json())
      .then(newMessage => {
        setMessages(prev => [...prev, newMessage]);
        setInputText('');
        
        // Update read tracking to include our own sent message
        localStorage.setItem(`chat_last_read_${currentUser.id}_${activeChannel.id}`, newMessage.id.toString());
      })
      .catch(err => console.error("Error sending message:", err));
  };

  // Create Direct Message channel
  const handleStartDM = (otherUser) => {
    // Look if DM channel already exists
    const searchName1 = `${currentUser.name} & ${otherUser.name}`;
    const searchName2 = `${otherUser.name} & ${currentUser.name}`;
    const existing = channels.find(c => c.type === 'direct' && (c.name === searchName1 || c.name === searchName2));

    if (existing) {
      setActiveChannel(existing);
      setShowDmModal(false);
      return;
    }

    // Create a new DM channel
    const payload = {
      name: `${currentUser.name} & ${otherUser.name}`,
      type: 'direct',
      members: [currentUser.id, otherUser.id],
      created_by: currentUser.id
    };

    fetch('/api/chat/channels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(res => res.json())
      .then(newChannel => {
        setChannels(prev => [...prev, newChannel]);
        setActiveChannel(newChannel);
        setShowDmModal(false);
      })
      .catch(err => console.error("Error creating DM channel:", err));
  };

  // Create Group Chat channel
  const handleCreateGroup = (e) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;

    const payload = {
      name: newGroupName.trim(),
      type: 'group',
      members: [...selectedGroupMembers, currentUser.id],
      created_by: currentUser.id
    };

    fetch('/api/chat/channels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(res => res.json())
      .then(newChannel => {
        setChannels(prev => [...prev, newChannel]);
        setActiveChannel(newChannel);
        setShowGroupModal(false);
        setNewGroupName('');
        setSelectedGroupMembers([]);
      })
      .catch(err => console.error("Error creating group channel:", err));
  };

  const getRoleBadgeClass = (senderName) => {
    const role = staffMap[senderName] || 'Staff';
    if (role.includes('Admin')) return 'badge-red';
    if (role.includes('Manager') || role.includes('Head')) return 'badge-amber';
    if (role.includes('Stylist')) return 'badge-violet';
    if (role.includes('Crew') || role.includes('Removalist')) return 'badge-blue';
    return 'badge-slate';
  };

  const getRoleLabel = (senderName) => {
    return staffMap[senderName] || 'Staff';
  };

  const getAvatarColor = (senderName) => {
    let hash = 0;
    for (let i = 0; i < senderName.length; i++) {
      hash = senderName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colors = ['#9333ea', '#2563eb', '#059669', '#d97706', '#dc2626', '#db2777'];
    return colors[Math.abs(hash) % colors.length];
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    const date = new Date(timeStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Helper to format DM channel name display (filters out the current user's name)
  const formatChannelName = (c) => {
    if (c.type === 'direct') {
      return c.name.replace(currentUser.name, '').replace('&', '').trim();
    }
    return c.name;
  };

  return (
    <>
      <style>{`
        .chat-container {
          display: flex;
          height: calc(100vh - 160px);
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          overflow: hidden;
          box-shadow: var(--shadow);
          backdrop-filter: blur(16px);
        }

        .chat-sidebar {
          width: 300px;
          border-right: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          background: rgba(13, 16, 26, 0.4);
          flex-shrink: 0;
        }

        .chat-sidebar-header {
          padding: 16px 20px;
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .chat-sidebar-header h3 {
          font-size: 15px;
          font-weight: 600;
          color: var(--text-main);
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .refresh-btn {
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          padding: 6px;
          border-radius: var(--radius-sm);
          transition: var(--transition-fast);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .refresh-btn:hover {
          color: var(--text-main);
          background: rgba(255, 255, 255, 0.05);
        }

        .channels-list {
          flex-grow: 1;
          overflow-y: auto;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .channels-header-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-right: 4px;
        }

        .channels-section-title {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--text-muted);
          padding-left: 8px;
        }

        .create-channel-btn {
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          padding: 2px;
          border-radius: 4px;
          transition: var(--transition-fast);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .create-channel-btn:hover {
          color: var(--primary);
          background: rgba(255,255,255,0.05);
        }

        .channels-group {
          display: flex;
          flex-direction: column;
          gap: 4px;
          margin-top: 8px;
        }

        .channel-btn {
          width: 100%;
          background: transparent;
          border: none;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 12px;
          border-radius: var(--radius-sm);
          color: var(--text-muted);
          text-align: left;
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
          transition: var(--transition-fast);
        }

        .channel-btn-content {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
          flex-grow: 1;
        }

        .channel-btn:hover {
          color: var(--text-main);
          background: rgba(255, 255, 255, 0.03);
        }

        .channel-btn.active {
          color: var(--text-main);
          background: var(--primary-glow);
          border-left: 3px solid var(--primary);
          padding-left: 9px;
        }

        .unread-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--danger);
          flex-shrink: 0;
          box-shadow: 0 0 6px var(--danger);
        }

        .user-profile-bar {
          padding: 16px 20px;
          border-top: 1px solid var(--border);
          background: rgba(13, 16, 26, 0.6);
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .user-avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          color: #fff;
          font-size: 14px;
          box-shadow: 0 4px 10px rgba(0,0,0,0.3);
          flex-shrink: 0;
        }

        .user-info {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .user-info h4 {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-main);
          margin-bottom: 2px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .user-info p {
          font-size: 10px;
          color: var(--text-muted);
        }

        .chat-main {
          flex-grow: 1;
          display: flex;
          flex-direction: column;
          background: rgba(13, 16, 26, 0.2);
          min-width: 0;
        }

        .chat-header {
          padding: 16px 24px;
          border-bottom: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          justify-content: center;
          backdrop-filter: blur(10px);
          background: rgba(20, 24, 38, 0.3);
        }

        .chat-header-title {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .chat-header-title h2 {
          font-size: 17px;
          font-weight: 700;
          color: var(--text-main);
        }

        .chat-header p {
          font-size: 12px;
          color: var(--text-muted);
          margin-top: 4px;
        }

        .messages-feed {
          flex-grow: 1;
          overflow-y: auto;
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .no-messages-container {
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 40px;
        }

        .no-messages-icon {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: rgba(255,255,255,0.03);
          border: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-muted);
          margin-bottom: 16px;
        }

        .no-messages-container h4 {
          font-size: 16px;
          color: var(--text-main);
          margin-bottom: 6px;
        }

        .no-messages-container p {
          font-size: 12px;
          color: var(--text-muted);
          max-w: 320px;
        }

        .message-wrapper {
          display: flex;
          gap: 12px;
          align-items: flex-start;
        }

        .message-wrapper.me {
          flex-direction: row-reverse;
        }

        .msg-bubble-container {
          display: flex;
          flex-direction: column;
          max-width: 70%;
        }

        .message-wrapper.me .msg-bubble-container {
          align-items: flex-end;
        }

        .msg-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 4px;
        }

        .msg-sender-name {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-main);
        }

        .badge-red {
          background: rgba(239, 68, 68, 0.15);
          color: #fca5a5;
          border: 1px solid rgba(239, 68, 68, 0.25);
        }
        .badge-amber {
          background: rgba(245, 158, 11, 0.15);
          color: #fcd34d;
          border: 1px solid rgba(245, 158, 11, 0.25);
        }
        .badge-violet {
          background: rgba(139, 92, 246, 0.15);
          color: #c4b5fd;
          border: 1px solid rgba(139, 92, 246, 0.25);
        }
        .badge-blue {
          background: rgba(59, 130, 246, 0.15);
          color: #93c5fd;
          border: 1px solid rgba(59, 130, 246, 0.25);
        }
        .badge-slate {
          background: rgba(100, 116, 139, 0.15);
          color: #cbd5e1;
          border: 1px solid rgba(100, 116, 139, 0.25);
        }

        .msg-badge {
          font-size: 9px;
          padding: 2px 6px;
          border-radius: 20px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .msg-bubble {
          padding: 10px 14px;
          border-radius: var(--radius-md);
          font-size: 13.5px;
          line-height: 1.5;
          border: 1px solid var(--border);
          white-space: pre-wrap;
          word-break: break-word;
        }

        .message-wrapper.me .msg-bubble {
          background: linear-gradient(135deg, var(--primary), #8b5cf6);
          color: #fff;
          border-top-right-radius: 0;
          border-color: rgba(255,255,255,0.1);
          box-shadow: 0 4px 12px rgba(115, 98, 255, 0.15);
        }

        .message-wrapper.other .msg-bubble {
          background: rgba(255, 255, 255, 0.03);
          color: #e2e8f0;
          border-top-left-radius: 0;
        }

        .msg-time {
          font-size: 9.5px;
          color: var(--text-muted);
          margin-top: 4px;
          padding: 0 2px;
        }

        .chat-input-bar {
          padding: 16px 24px;
          border-top: 1px solid var(--border);
          background: rgba(13, 16, 26, 0.3);
        }

        .chat-input-form {
          display: flex;
          gap: 12px;
        }

        .chat-input-field {
          flex-grow: 1;
          padding: 12px 16px;
          background: var(--bg-input);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          color: var(--text-main);
          font-size: 13.5px;
          outline: none;
          transition: var(--transition-fast);
        }

        .chat-input-field:focus {
          border-color: var(--primary);
          box-shadow: 0 0 0 1px var(--primary);
        }

        .chat-send-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 20px;
          background: var(--primary);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: var(--radius-sm);
          color: #fff;
          font-weight: 600;
          font-size: 13.5px;
          cursor: pointer;
          transition: var(--transition-fast);
        }

        .chat-send-btn:hover {
          background: var(--primary-hover);
          box-shadow: 0 4px 14px var(--primary-glow);
        }

        .chat-send-btn:disabled {
          background: rgba(255,255,255,0.03);
          color: var(--text-muted);
          border-color: transparent;
          cursor: not-allowed;
          box-shadow: none;
        }

        /* Modal Styles */
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(10px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .chat-modal {
          background: #111420;
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          width: 450px;
          max-width: 90%;
          overflow: hidden;
          box-shadow: var(--shadow);
          display: flex;
          flex-direction: column;
        }

        .modal-header {
          padding: 16px 20px;
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .modal-header h3 {
          font-size: 16px;
          font-weight: 600;
          color: #fff;
        }

        .close-modal-btn {
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          transition: var(--transition-fast);
        }

        .close-modal-btn:hover {
          color: #fff;
        }

        .modal-body {
          padding: 20px;
          max-height: 350px;
          overflow-y: auto;
        }

        .contacts-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .contact-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 12px;
          border-radius: var(--radius-sm);
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid transparent;
          transition: var(--transition-fast);
          cursor: pointer;
        }

        .contact-row:hover {
          background: rgba(255,255,255,0.05);
          border-color: var(--border-glow);
        }

        .contact-profile-col {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .modal-footer {
          padding: 16px 20px;
          border-top: 1px solid var(--border);
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          background: rgba(0,0,0,0.1);
        }

        .group-checkbox {
          width: 18px;
          height: 18px;
          accent-color: var(--primary);
          cursor: pointer;
        }
      `}</style>

      <div className="chat-container">
        {/* Sidebar Channels List */}
        <div className="chat-sidebar">
          <div className="chat-sidebar-header">
            <h3>
              <MessageSquare className="w-5 h-5 text-primary" style={{ width: '18px', height: '18px' }} />
              <span>Company Chat</span>
            </h3>
            <button 
              onClick={() => fetchChannels(false)} 
              className="refresh-btn"
              title="Refresh channels"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} style={{ width: '14px', height: '14px', color: isLoading ? 'var(--primary)' : 'inherit' }} />
            </button>
          </div>

          <div className="channels-list">
            {/* System Boards */}
            <div>
              <span className="channels-section-title">System Board</span>
              <div className="channels-group">
                {channels.filter(c => c.type === 'global').map(c => (
                  <button
                    key={c.id}
                    onClick={() => setActiveChannel(c)}
                    className={`channel-btn ${activeChannel?.id === c.id ? 'active' : ''}`}
                  >
                    <div className="channel-btn-content">
                      <Users className="w-4 h-4" style={{ width: '16px', height: '16px', color: 'var(--primary)', flexShrink: 0 }} />
                      <span className="truncate">{c.name}</span>
                    </div>
                    {unreadMap[c.id] && <div className="unread-dot"></div>}
                  </button>
                ))}
              </div>
            </div>

            {/* Active Staging Rooms */}
            <div>
              <span className="channels-section-title">Active Job Rooms</span>
              <div className="channels-group">
                {channels.filter(c => c.type === 'job').length === 0 ? (
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', paddingLeft: '12px', fontStyle: 'italic', marginTop: '6px' }}>No active jobs.</div>
                ) : (
                  channels.filter(c => c.type === 'job').map(c => (
                    <button
                      key={c.id}
                      onClick={() => setActiveChannel(c)}
                      className={`channel-btn ${activeChannel?.id === c.id ? 'active' : ''}`}
                    >
                      <div className="channel-btn-content">
                        <Hash className="w-4 h-4" style={{ width: '16px', height: '16px', color: 'var(--info)', flexShrink: 0 }} />
                        <span className="truncate">{c.name}</span>
                      </div>
                      {unreadMap[c.id] && <div className="unread-dot"></div>}
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Direct Messages (DMs) */}
            <div>
              <div className="channels-header-row">
                <span className="channels-section-title">Direct Messages</span>
                <button className="create-channel-btn" onClick={() => setShowDmModal(true)} title="New chat">
                  <Plus size={14} />
                </button>
              </div>
              <div className="channels-group">
                {channels.filter(c => c.type === 'direct').length === 0 ? (
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', paddingLeft: '12px', fontStyle: 'italic', marginTop: '6px' }}>No DMs started.</div>
                ) : (
                  channels.filter(c => c.type === 'direct').map(c => (
                    <button
                      key={c.id}
                      onClick={() => setActiveChannel(c)}
                      className={`channel-btn ${activeChannel?.id === c.id ? 'active' : ''}`}
                    >
                      <div className="channel-btn-content">
                        <div 
                          className="user-avatar" 
                          style={{ 
                            width: '18px', 
                            height: '18px', 
                            fontSize: '9px',
                            backgroundColor: getAvatarColor(formatChannelName(c)) 
                          }}
                        >
                          {formatChannelName(c).charAt(0)}
                        </div>
                        <span className="truncate">{formatChannelName(c)}</span>
                      </div>
                      {unreadMap[c.id] && <div className="unread-dot"></div>}
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Group Chats */}
            <div>
              <div className="channels-header-row">
                <span className="channels-section-title">Group Chats</span>
                <button className="create-channel-btn" onClick={() => setShowGroupModal(true)} title="New group">
                  <Plus size={14} />
                </button>
              </div>
              <div className="channels-group">
                {channels.filter(c => c.type === 'group').length === 0 ? (
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', paddingLeft: '12px', fontStyle: 'italic', marginTop: '6px' }}>No groups created.</div>
                ) : (
                  channels.filter(c => c.type === 'group').map(c => (
                    <button
                      key={c.id}
                      onClick={() => setActiveChannel(c)}
                      className={`channel-btn ${activeChannel?.id === c.id ? 'active' : ''}`}
                    >
                      <div className="channel-btn-content">
                        <MessageSquare className="w-4 h-4" style={{ width: '16px', height: '16px', color: 'var(--success)', flexShrink: 0 }} />
                        <span className="truncate">{c.name}</span>
                      </div>
                      {unreadMap[c.id] && <div className="unread-dot"></div>}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* User Profile Bar */}
          <div className="user-profile-bar">
            <div className="user-avatar" style={{ backgroundColor: getAvatarColor(currentUser?.name || 'G') }}>
              {(currentUser?.name || 'G').charAt(0)}
            </div>
            <div className="user-info">
              <h4>{currentUser?.name || 'Guest'}</h4>
              <p>{currentUser?.role || 'Staff'}</p>
            </div>
          </div>
        </div>

        {/* Main Chat Panel */}
        <div className="chat-main">
          {activeChannel ? (
            <>
              {/* Channel Header */}
              <div className="chat-header">
                <div className="chat-header-title">
                  {activeChannel.type === 'global' && <Users className="w-5 h-5" style={{ width: '20px', height: '20px', color: 'var(--primary)' }} />}
                  {activeChannel.type === 'job' && <Hash className="w-5 h-5" style={{ width: '20px', height: '20px', color: 'var(--info)' }} />}
                  {activeChannel.type === 'direct' && <Users className="w-5 h-5" style={{ width: '20px', height: '20px', color: 'var(--primary)' }} />}
                  {activeChannel.type === 'group' && <MessageSquare className="w-5 h-5" style={{ width: '20px', height: '20px', color: 'var(--success)' }} />}
                  <h2>#{formatChannelName(activeChannel)}</h2>
                </div>
                <p>{activeChannel.description || `${activeChannel.type.toUpperCase()} chat channel`}</p>
              </div>

              {/* Messages Feed */}
              <div className="messages-feed">
                {messages.length === 0 ? (
                  <div className="no-messages-container">
                    <div className="no-messages-icon">
                      <MessageSquare className="w-8 h-8" style={{ width: '32px', height: '32px' }} />
                    </div>
                    <h4>No messages yet</h4>
                    <p>Be the first to send a message in this channel! Coordinate logistics, staging plans, or WHS reports here.</p>
                  </div>
                ) : (
                  messages.map(m => {
                    const isMe = m.sender_name === currentUser.name;
                    return (
                      <div key={m.id} className={`message-wrapper ${isMe ? 'me' : 'other'}`}>
                        <div className="user-avatar" style={{ backgroundColor: getAvatarColor(m.sender_name) }}>
                          {m.sender_name.charAt(0)}
                        </div>
                        <div className="msg-bubble-container">
                          <div className="msg-header">
                            <span className="msg-sender-name">{m.sender_name}</span>
                            <span className={`msg-badge ${getRoleBadgeClass(m.sender_name)}`}>
                              {getRoleLabel(m.sender_name)}
                            </span>
                          </div>
                          <div className="msg-bubble">{m.message_text}</div>
                          <span className="msg-time">{formatTime(m.created_at)}</span>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Form */}
              <div className="chat-input-bar">
                <form onSubmit={handleSendMessage} className="chat-input-form">
                  <input
                    type="text"
                    value={inputText}
                    onChange={e => setInputText(e.target.value)}
                    placeholder={`Send message to #${formatChannelName(activeChannel)}...`}
                    className="chat-input-field"
                  />
                  <button type="submit" disabled={!inputText.trim()} className="chat-send-btn">
                    <span>Send</span>
                    <Send className="w-4 h-4" style={{ width: '16px', height: '16px' }} />
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="no-messages-container">
              <div className="no-messages-icon">
                <MessageSquare className="w-8 h-8" style={{ width: '32px', height: '32px' }} />
              </div>
              <h4>No channel selected</h4>
              <p>Choose a channel from the sidebar or click '+' to start a Direct Message or Group Chat!</p>
            </div>
          )}
        </div>
      </div>

      {/* --- CREATE DM MODAL --- */}
      {showDmModal && (
        <div className="modal-overlay">
          <div className="chat-modal">
            <div className="modal-header">
              <h3>Start Direct Message</h3>
              <button className="close-modal-btn" onClick={() => setShowDmModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <div className="contacts-list">
                {staffList
                  .filter(s => s.id !== currentUser.id)
                  .map(s => (
                    <div key={s.id} className="contact-row" onClick={() => handleStartDM(s)}>
                      <div className="contact-profile-col">
                        <div className="user-avatar" style={{ backgroundColor: getAvatarColor(s.name) }}>
                          {s.name.charAt(0)}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '13px', fontWeight: '600', color: '#fff' }}>{s.name}</span>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{s.role}</span>
                        </div>
                      </div>
                      <UserPlus size={16} style={{ color: 'var(--primary)' }} />
                    </div>
                  ))}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowDmModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* --- CREATE GROUP MODAL --- */}
      {showGroupModal && (
        <div className="modal-overlay">
          <form onSubmit={handleCreateGroup} className="chat-modal">
            <div className="modal-header">
              <h3>Create Group Chat</h3>
              <button type="button" className="close-modal-btn" onClick={() => setShowGroupModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>Group Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. removalist-coordination"
                  value={newGroupName}
                  onChange={e => setNewGroupName(e.target.value)}
                  className="chat-input-field"
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>Select Members</label>
                <div className="contacts-list" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  {staffList
                    .filter(s => s.id !== currentUser.id)
                    .map(s => {
                      const checked = selectedGroupMembers.includes(s.id);
                      return (
                        <div 
                          key={s.id} 
                          className="contact-row" 
                          onClick={() => {
                            if (checked) {
                              setSelectedGroupMembers(prev => prev.filter(id => id !== s.id));
                            } else {
                              setSelectedGroupMembers(prev => [...prev, s.id]);
                            }
                          }}
                        >
                          <div className="contact-profile-col">
                            <div className="user-avatar" style={{ backgroundColor: getAvatarColor(s.name) }}>
                              {s.name.charAt(0)}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontSize: '13px', fontWeight: '600', color: '#fff' }}>{s.name}</span>
                              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{s.role}</span>
                            </div>
                          </div>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {}} // handled by row click
                            className="group-checkbox"
                          />
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowGroupModal(false)}>Cancel</button>
              <button 
                type="submit" 
                className="chat-send-btn" 
                disabled={!newGroupName.trim() || selectedGroupMembers.length === 0}
              >
                <FolderPlus size={16} />
                <span>Create Group</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

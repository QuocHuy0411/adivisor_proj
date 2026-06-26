import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { createChatClient, sendChatMessage, subscribeConversation } from '../api/chatSocket.js';
import AppLayout from '../components/AppLayout.jsx';
import Toast from '../components/Toast.jsx';
import { useAuth } from '../context/AuthContext.jsx';

function formatTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleString('vi-VN');
}

export default function ChatPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAdvisorInfo, setShowAdvisorInfo] = useState(false);
  const clientRef = useRef(null);
  const subscriptionRef = useRef(null);
  const messagesEndRef = useRef(null);

  const isAdvisor = user?.loai_tai_khoan === 'covan';
  const selectedId = searchParams.get('conversation') || activeConversation?.maHoiThoai;

  async function loadConversations() {
    const { data } = await api.get('/chat/conversations');
    setConversations(data);
    return data;
  }

  async function openConversation(payload) {
    const { data } = await api.post('/chat/conversations', payload || {});
    setActiveConversation(data);
    setSearchParams({ conversation: data.maHoiThoai });
    return data;
  }

  async function loadMessages(conversationId) {
    const { data } = await api.get(`/chat/conversations/${conversationId}/messages`, {
      params: { page: 0, size: 100 }
    });
    setMessages(data);
    await api.post(`/chat/conversations/${conversationId}/read`);
  }

  async function selectConversation(conversation) {
    setActiveConversation(conversation);
    setShowAdvisorInfo(false);
    setSearchParams({ conversation: conversation.maHoiThoai });
    await loadMessages(conversation.maHoiThoai);
  }

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        setLoading(true);
        setError('');

        if (isAdvisor) {
          const items = await loadConversations();
          const fromQuery = items.find((item) => item.maHoiThoai === searchParams.get('conversation'));
          if (fromQuery) {
            await selectConversation(fromQuery);
          }
        } else {
          const conversation = await openConversation();
          if (!cancelled) {
            await loadMessages(conversation.maHoiThoai);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.message || 'Không thể tải phòng chat');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [user?.loai_tai_khoan]);

  useEffect(() => {
    if (!selectedId) return undefined;

    clientRef.current = createChatClient(
      () => {
        subscriptionRef.current?.unsubscribe();
        subscriptionRef.current = subscribeConversation(clientRef.current, selectedId, (message) => {
          setMessages((prev) => {
            if (prev.some((item) => item.maTinNhan === message.maTinNhan)) {
              return prev;
            }
            return [...prev, message];
          });
        });
      },
      (message) => setError(message)
    );

    return () => {
      subscriptionRef.current?.unsubscribe();
      clientRef.current?.deactivate();
    };
  }, [selectedId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const counterpartLabel = useMemo(() => {
    if (!activeConversation) return 'Chat';
    return isAdvisor
      ? activeConversation.tenSinhVien
      : activeConversation.tenCoVan;
  }, [activeConversation, isAdvisor]);

  const advisorDetails = useMemo(() => {
    if (!activeConversation || isAdvisor) return [];
    return [
      ['Họ và tên', activeConversation.tenCoVan],
      ['Email', activeConversation.emailCoVan],
      ['Số điện thoại', activeConversation.soDienThoaiCoVan],
      ['Khoa', activeConversation.tenKhoaCoVan],
      ['Chuyên ngành', activeConversation.chuyenNganhCoVan]
    ];
  }, [activeConversation, isAdvisor]);

  async function handleSend(event) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || !selectedId || !clientRef.current?.connected) return;

    try {
      sendChatMessage(clientRef.current, selectedId, content);
      setDraft('');
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể gửi tin nhắn');
    }
  }

  async function handleOpenStudentChat(studentId) {
    try {
      setError('');
      const conversation = await openConversation({ maSinhVien: studentId });
      await loadConversations();
      await loadMessages(conversation.maHoiThoai);
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể mở phòng chat');
    }
  }

  return (
    <AppLayout title="Liên hệ với CVHT">
      <Toast message={error} type="error" onClose={() => setError('')} />
      <section className={`panel chat-layout ${!isAdvisor ? 'no-sidebar' : ''}`}>
        {isAdvisor ? (
          <aside className="chat-sidebar">
            <h2>Hội thoại</h2>
            {conversations.length === 0 ? (
              <p>Chưa có hội thoại. Chọn sinh viên ở bảng bên dưới để bắt đầu chat.</p>
            ) : (
              conversations.map((item) => (
                <button
                  key={item.maHoiThoai}
                  type="button"
                  className={item.maHoiThoai === selectedId ? 'chat-thread active' : 'chat-thread'}
                  onClick={() => selectConversation(item)}
                >
                  <strong>{item.tenSinhVien}</strong>
                  <span>{item.tenLop}</span>
                  {item.soTinNhanChuaDoc > 0 ? (
                    <em>{item.soTinNhanChuaDoc} chưa đọc</em>
                  ) : null}
                </button>
              ))
            )}
          </aside>
        ) : null}

        <div className="chat-main">
          <div className="chat-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '18px', fontWeight: '700' }}>
                {counterpartLabel ? counterpartLabel.charAt(0).toUpperCase() : '?'}
              </div>
              <div>
                <h2>{counterpartLabel}</h2>
                {activeConversation ? (
                  <span>{activeConversation.tenLop}</span>
                ) : null}
              </div>
            </div>
            {!isAdvisor && activeConversation ? (
              <button
                type="button"
                className="secondary chat-advisor-info-btn"
                onClick={() => setShowAdvisorInfo((value) => !value)}
              >
                {showAdvisorInfo ? 'Ẩn thông tin' : 'ℹ️ Thông tin CVHT'}
              </button>
            ) : null}
          </div>

          {showAdvisorInfo && advisorDetails.length > 0 ? (
            <div className="chat-advisor-info">
              {advisorDetails.map(([label, value]) => (
                <div key={label}>
                  <span>{label}</span>
                  <strong>{value || '-'}</strong>
                </div>
              ))}
            </div>
          ) : null}

          <div className="chat-messages">
            {loading ? <p>Đang tải tin nhắn...</p> : null}
            {!loading && messages.length === 0 ? <p>Chưa có tin nhắn nào. Hãy bắt đầu cuộc trò chuyện!</p> : null}
            {messages.map((message) => {
              const mine = message.maNguoiGui === user?.ma_tai_khoan;
              return (
                <div key={message.maTinNhan} className={mine ? 'chat-bubble mine' : 'chat-bubble'}>
                  <div className="chat-bubble-meta">
                    <strong>{message.tenNguoiGui}</strong>
                    <span>{formatTime(message.thoiGianGui)}</span>
                  </div>
                  <p>{message.noiDung}</p>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          <form className="chat-composer" onSubmit={handleSend}>
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Nhập tin nhắn..."
              maxLength={2000}
              disabled={!selectedId || loading}
            />
            <button type="submit" disabled={!selectedId || loading || !draft.trim()} aria-label="Gửi tin nhắn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
            </button>
          </form>
        </div>
      </section>

      {isAdvisor ? (
        <AdvisorStudentPicker onOpenChat={handleOpenStudentChat} />
      ) : null}
    </AppLayout>
  );
}

function AdvisorStudentPicker({ onOpenChat }) {
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');

  useEffect(() => {
    api.get('/covan/classes').then((res) => setClasses(res.data));
  }, []);

  async function loadStudents(classId) {
    setSelectedClass(classId);
    const { data } = await api.get(`/covan/classes/${classId}/students`);
    setStudents(data);
  }

  return (
    <section className="panel">
      <h2>Mở chat với sinh viên</h2>
      <div className="panel-actions">
        {classes.map((item) => (
          <button
            key={item.ma_lop}
            type="button"
            className={selectedClass === item.ma_lop ? 'secondary active' : 'secondary'}
            onClick={() => loadStudents(item.ma_lop)}
          >
            {item.ten_lop}
          </button>
        ))}
      </div>
      <div className="chat-student-list">
        {students.map((student) => (
          <button key={student.ma_sinh_vien} type="button" onClick={() => onOpenChat(student.ma_sinh_vien)}>
            {student.ma_sinh_vien} - {student.ho_va_ten}
          </button>
        ))}
      </div>
    </section>
  );
}

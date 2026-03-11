import { useState, useRef, useEffect } from 'react';
import { Drawer, Input, Button, Spin, Typography } from 'antd';
import { Bot, Send, X } from 'lucide-react';
import api from '../services/api';
import { COLORS } from '../utils/constants';

const { Text } = Typography;

const QUICK_QUESTIONS = [
  'endpoint ไหนช้าที่สุด?',
  'Error rate สูงผิดปกติไหม?',
  'DB queries ช้าตรงไหน?',
  'สรุปสถานะระบบตอนนี้',
];

export default function PerformanceAIChat({ open, onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const sendMessage = async (text) => {
    const question = text || input.trim();
    if (!question || loading) return;

    setMessages((prev) => [...prev, { role: 'user', content: question }]);
    setInput('');
    setLoading(true);

    try {
      const { data } = await api.post('/api/admin/performance/ask', { question });
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.answer || 'ไม่มีข้อมูล',
          meta: data.model_used && data.model_used !== 'none'
            ? `Model: ${data.model_used} | Tokens: ${data.tokens_used || 0}`
            : null,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Error: ${err.response?.data?.detail || 'ไม่สามารถตอบได้'}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <Drawer
      title={
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: COLORS.text }}>
          <Bot size={18} /> AI Performance Chat
        </span>
      }
      placement="right"
      width={450}
      open={open}
      onClose={onClose}
      closeIcon={<X size={16} style={{ color: COLORS.textSecondary }} />}
      styles={{
        header: { background: COLORS.surface, borderBottom: `1px solid ${COLORS.border}` },
        body: { background: COLORS.bg, padding: 0, display: 'flex', flexDirection: 'column' },
      }}
    >
      {/* Messages area */}
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '32px 16px' }}>
            <Bot size={40} style={{ color: COLORS.textMuted, marginBottom: 12 }} />
            <div style={{ color: COLORS.textMuted, fontSize: 13, marginBottom: 20 }}>
              ถามอะไรก็ได้เกี่ยวกับ Performance ของระบบ
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
              {QUICK_QUESTIONS.map((q) => (
                <Button
                  key={q}
                  size="small"
                  style={{
                    background: COLORS.surface,
                    borderColor: COLORS.border,
                    color: COLORS.accent,
                    fontSize: 12,
                  }}
                  onClick={() => sendMessage(q)}
                >
                  {q}
                </Button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              marginBottom: 12,
            }}
          >
            <div
              style={{
                maxWidth: '85%',
                padding: '10px 14px',
                borderRadius: 12,
                fontSize: 13,
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                ...(msg.role === 'user'
                  ? { background: COLORS.accent + '22', color: COLORS.text, borderBottomRightRadius: 4 }
                  : { background: COLORS.surface, color: COLORS.text, borderBottomLeftRadius: 4, border: `1px solid ${COLORS.border}` }),
              }}
            >
              {msg.content}
              {msg.meta && (
                <div style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 6 }}>
                  {msg.meta}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 12 }}>
            <div
              style={{
                background: COLORS.surface,
                border: `1px solid ${COLORS.border}`,
                padding: '10px 20px',
                borderRadius: 12,
                borderBottomLeftRadius: 4,
              }}
            >
              <Spin size="small" />
              <Text style={{ color: COLORS.textMuted, fontSize: 12, marginLeft: 8 }}>
                กำลังวิเคราะห์...
              </Text>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div
        style={{
          padding: 12,
          borderTop: `1px solid ${COLORS.border}`,
          background: COLORS.surface,
          display: 'flex',
          gap: 8,
        }}
      >
        <Input.TextArea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="ถามเกี่ยวกับ performance..."
          autoSize={{ minRows: 1, maxRows: 3 }}
          style={{
            background: COLORS.bg,
            borderColor: COLORS.border,
            color: COLORS.text,
            resize: 'none',
            flex: 1,
          }}
        />
        <Button
          type="primary"
          icon={<Send size={14} />}
          onClick={() => sendMessage()}
          loading={loading}
          disabled={!input.trim()}
          style={{ alignSelf: 'flex-end' }}
        />
      </div>
    </Drawer>
  );
}

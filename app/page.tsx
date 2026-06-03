'use client';

import { useState, useRef } from 'react';
import type { StreamEvent } from '@/src/stream';
import type { StructuredOutput } from '@/src/output';

interface DisplayEvent {
  type: string;
  content?: string;
  name?: string;
  args?: Record<string, unknown>;
  result?: string;
  message?: string;
}

export default function Home() {
  const [prUrl, setPrUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<DisplayEvent[]>([]);
  const [finalData, setFinalData] = useState<StructuredOutput | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function handleAnalyze() {
    if (!prUrl.trim()) return;

    setLoading(true);
    setEvents([]);
    setFinalData(null);

    abortRef.current = new AbortController();

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prUrl: prUrl.trim() }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const err = await res.json();
        setEvents([{ type: 'error', message: err.error || '请求失败' }]);
        setLoading(false);
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;

            try {
              const event: StreamEvent = JSON.parse(data);

              if (event.type === 'final') {
                setFinalData(event.data);
              } else {
                setEvents((prev) => [...prev, event]);
              }
            } catch {
              // skip malformed SSE lines
            }
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setEvents((prev) => [
          ...prev,
          { type: 'error', message: err.message },
        ]);
      }
    }

    setLoading(false);
  }
  return (
    <div className="container">
      <h1>PR 摘要 Agent</h1>

      <div className="input-row">
        <input
          type="text"
          placeholder="https://github.com/owner/repo/pull/123"
          value={prUrl}
          onChange={(e) => setPrUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !loading && handleAnalyze()}
          disabled={loading}
        />
        <button onClick={handleAnalyze} disabled={loading || !prUrl.trim()}>
          {loading ? '分析中...' : '分析'}
        </button>
      </div>

      {events.length > 0 && (
        <div className="stream-area">
          {events.map((event, i) => {
            if (event.type === 'text') {
              return <span key={i}>{event.content}</span>;
            }
            if (event.type === 'tool_start') {
              return (
                <div key={i} className="tool-event">
                  {'\n'}🔧 调用: {event.name}
                </div>
              );
            }
            if (event.type === 'tool_end') {
              return (
                <div key={i} className="tool-event">
                  ✓ {event.name} 完成
                </div>
              );
            }
            if (event.type === 'error') {
              return (
                <div key={i} className="error-event">
                  ⚠️ {event.message}
                </div>
              );
            }
            return null;
          })}
        </div>
      )}

      {finalData && (
        <div className="final-card">
          <h2>结构化摘要</h2>
          <div className="field">
            <div className="label">摘要</div>
            <div className="value">{finalData.summary}</div>
          </div>
          <div className="field">
            <div className="label">变更文件数</div>
            <div className="value">{finalData.files_changed}</div>
          </div>
          <div className="field">
            <div className="label">风险等级</div>
            <div className={`value risk-${finalData.risk_level}`}>
              {finalData.risk_level.toUpperCase()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

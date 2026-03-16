'use client';

import { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

interface ConnectionStatusProps {
  className?: string;
}

export function ConnectionStatus({ className = '' }: ConnectionStatusProps) {
  const [status, setStatus] = useState<'loading' | 'connected' | 'error' | 'waking'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const checkConnection = async () => {
      try {
        const response = await fetch('/api/health');
        const data = await response.json();
        
        if (data.status === 'healthy') {
          setStatus('connected');
          setMessage('서비스 정상 작동 중');
        } else if (data.status === 'waking_up') {
          setStatus('waking');
          setMessage('서버를 재가동 중입니다...');
        } else {
          setStatus('error');
          setMessage(data.message || '연결 오류');
        }
      } catch (error) {
        setStatus('error');
        setMessage('서버 상태 확인 중 오류');
      }
    };

    checkConnection();
    
    // 30초마다 상태 확인
    const interval = setInterval(checkConnection, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = () => {
    switch (status) {
      case 'loading':
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'connected':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'waking':
        return <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'loading':
        return 'text-gray-600 bg-gray-50';
      case 'connected':
        return 'text-green-700 bg-green-50';
      case 'waking':
        return 'text-yellow-700 bg-yellow-50';
      case 'error':
        return 'text-red-700 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${getStatusColor()} ${className}`}>
      {getStatusIcon()}
      <span className="font-medium">{message}</span>
    </div>
  );
}

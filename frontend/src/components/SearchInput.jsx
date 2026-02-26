import { useState, useEffect, useRef } from 'react';
import { Input } from 'antd';
import { Search } from 'lucide-react';

export default function SearchInput({ onSearch, placeholder = '\u0E04\u0E49\u0E19\u0E2B\u0E32...', style }) {
  const [value, setValue] = useState('');
  const timerRef = useRef(null);

  useEffect(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onSearch(value);
    }, 300);
    return () => clearTimeout(timerRef.current);
  }, [value]);

  return (
    <Input
      prefix={<Search size={14} style={{ color: '#718096' }} />}
      placeholder={placeholder}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      allowClear
      style={{ maxWidth: 320, ...style }}
    />
  );
}

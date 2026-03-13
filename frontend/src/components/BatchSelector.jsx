/**
 * BatchSelector — Reusable batch/lot number picker (Phase 11.12)
 *
 * Props:
 *   productId   — required for consume mode (loads available batches)
 *   locationId  — optional location filter for consume mode
 *   value       — controlled value (batch_number string)
 *   onChange     — (batch_number) => void
 *   mode        — "receive" | "consume"
 *     receive: free-text Input + "Auto Generate" button
 *     consume: Select dropdown from /batch-numbers?product_id=X
 *   disabled    — disable the control
 *   size        — antd size: "small" | "middle" | "large"
 */
import { useState, useEffect, useCallback } from 'react';
import { Input, Select, Button, Space, App } from 'antd';
import { Sparkles } from 'lucide-react';
import api from '../services/api';
import { COLORS } from '../utils/constants';

export default function BatchSelector({
  productId,
  locationId,
  value,
  onChange,
  mode = 'receive',
  disabled = false,
  size = 'small',
  style,
}) {
  const [batches, setBatches] = useState([]);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [generating, setGenerating] = useState(false);
  const { message } = App.useApp();

  // Consume mode: fetch available batches when productId changes
  const fetchBatches = useCallback(async () => {
    if (mode !== 'consume' || !productId) {
      setBatches([]);
      return;
    }
    setLoadingBatches(true);
    try {
      const params = { product_id: productId };
      if (locationId) params.location_id = locationId;
      const res = await api.get('/api/inventory/batch-numbers', { params });
      setBatches(res.data?.items || []);
    } catch {
      setBatches([]);
    } finally {
      setLoadingBatches(false);
    }
  }, [mode, productId, locationId]);

  useEffect(() => {
    fetchBatches();
  }, [fetchBatches]);

  // Auto-generate batch number (receive mode)
  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await api.post('/api/inventory/generate-batch-number');
      const bn = res.data?.batch_number;
      if (bn) {
        onChange?.(bn);
        message.success(`Batch: ${bn}`);
      }
    } catch (err) {
      message.error(err.response?.data?.detail || 'ไม่สามารถสร้างเลข Batch ได้');
    } finally {
      setGenerating(false);
    }
  };

  // ---- RECEIVE MODE: free text + auto-generate button ----
  if (mode === 'receive') {
    return (
      <Space.Compact style={{ width: '100%', ...style }}>
        <Input
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder="Batch/Lot No. (ไม่บังคับ)"
          maxLength={50}
          disabled={disabled}
          size={size}
          style={{ flex: 1 }}
        />
        <Button
          icon={<Sparkles size={14} />}
          onClick={handleGenerate}
          loading={generating}
          disabled={disabled}
          size={size}
          title="Auto Generate"
        />
      </Space.Compact>
    );
  }

  // ---- CONSUME MODE: select dropdown from available batches ----
  return (
    <Select
      value={value}
      onChange={(v) => onChange?.(v)}
      placeholder="เลือก Batch"
      allowClear
      showSearch
      optionFilterProp="label"
      disabled={disabled || !productId}
      loading={loadingBatches}
      size={size}
      style={{ width: '100%', ...style }}
      notFoundContent={
        !productId
          ? 'เลือกสินค้าก่อน'
          : loadingBatches
            ? 'กำลังโหลด...'
            : 'ไม่มี Batch ที่มีสต็อก'
      }
      options={batches.map((b) => ({
        value: b.batch_number,
        label: `${b.batch_number} (คงเหลือ: ${b.on_hand})`,
      }))}
      dropdownStyle={{ background: COLORS.surface }}
    />
  );
}

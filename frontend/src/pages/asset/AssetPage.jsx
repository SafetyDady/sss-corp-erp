import { useState, useEffect, useCallback } from 'react';
import { Tabs, Row, Col, Card, Statistic, App } from 'antd';
import { Landmark, TrendingDown, CheckCircle, Package } from 'lucide-react';
import { usePermission } from '../../hooks/usePermission';
import api from '../../services/api';

import AssetRegisterTab from './AssetRegisterTab';
import DepreciationTab from './DepreciationTab';
import AssetCategoryTab from './AssetCategoryTab';

const COLORS = { cyan: '#06b6d4', cardBg: '#16161f', border: '#2a2a3a' };

export default function AssetPage() {
  const { can } = usePermission();
  const { message } = App.useApp();
  const [summary, setSummary] = useState(null);
  const [activeTab, setActiveTab] = useState('register');

  const fetchSummary = useCallback(async () => {
    try {
      const res = await api.get('/api/asset/assets/summary');
      setSummary(res.data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  const statCards = summary ? [
    { title: 'สินทรัพย์ทั้งหมด', value: summary.total_assets, icon: <Package size={20} />, color: COLORS.cyan },
    { title: 'ใช้งานอยู่', value: summary.total_active, icon: <CheckCircle size={20} />, color: '#22c55e' },
    { title: 'รวมราคาทุน', value: Number(summary.total_acquisition_cost).toLocaleString('th-TH', { minimumFractionDigits: 2 }), icon: <Landmark size={20} />, suffix: '฿', color: '#3b82f6' },
    { title: 'มูลค่าตามบัญชี (NBV)', value: Number(summary.total_net_book_value).toLocaleString('th-TH', { minimumFractionDigits: 2 }), icon: <TrendingDown size={20} />, suffix: '฿', color: '#f59e0b' },
  ] : [];

  const tabs = [];
  if (can('asset.asset.read')) tabs.push({ key: 'register', label: 'ทะเบียนสินทรัพย์', children: <AssetRegisterTab onRefresh={fetchSummary} /> });
  if (can('asset.depreciation.read')) tabs.push({ key: 'depreciation', label: 'ค่าเสื่อมราคา', children: <DepreciationTab /> });
  if (can('asset.category.read')) tabs.push({ key: 'category', label: 'หมวดสินทรัพย์', children: <AssetCategoryTab /> });

  return (
    <div>
      <h2 style={{ color: '#e2e8f0', marginBottom: 16 }}>
        <Landmark size={22} style={{ marginRight: 8, verticalAlign: 'middle', color: COLORS.cyan }} />
        ทะเบียนสินทรัพย์ถาวร
      </h2>

      {summary && (
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          {statCards.map((card, i) => (
            <Col xs={12} sm={12} md={6} key={i}>
              <Card size="small" style={{ background: COLORS.cardBg, border: `1px solid ${COLORS.border}` }}>
                <Statistic
                  title={<span style={{ color: '#94a3b8', fontSize: 12 }}>{card.title}</span>}
                  value={card.value}
                  suffix={card.suffix}
                  valueStyle={{ color: card.color, fontSize: 20 }}
                  prefix={card.icon}
                />
              </Card>
            </Col>
          ))}
        </Row>
      )}

      <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabs} />
    </div>
  );
}

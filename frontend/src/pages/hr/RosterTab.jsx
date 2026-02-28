import { useState, useEffect, useCallback } from 'react';
import { Table, Button, App, Space, DatePicker, Tag, Select, Modal, Form, Typography, Input } from 'antd';
import { RefreshCw, Plus, Pencil } from 'lucide-react';
import dayjs from 'dayjs';
import { usePermission } from '../../hooks/usePermission';
import EmployeeContextSelector from '../../components/EmployeeContextSelector';
import EmptyState from '../../components/EmptyState';
import api from '../../services/api';
import RosterGenerateModal from './RosterGenerateModal';
import { COLORS } from '../../utils/constants';

const { RangePicker } = DatePicker;
const { Text } = Typography;

const SHIFT_COLORS = {
  REGULAR: 'blue',
  MORNING: 'green',
  AFTERNOON: 'orange',
  NIGHT: 'purple',
  OFF: 'default',
};

export default function RosterTab() {
  const { can } = usePermission();
  const { message } = App.useApp();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [employeeId, setEmployeeId] = useState(undefined);
  const [dateRange, setDateRange] = useState([
    dayjs().startOf('week').add(1, 'day'), // Monday
    dayjs().startOf('week').add(1, 'day').add(13, 'day'), // 2 weeks
  ]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 50 });
  const [generateOpen, setGenerateOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [editForm] = Form.useForm();
  const [editLoading, setEditLoading] = useState(false);
  const [shiftTypes, setShiftTypes] = useState([]);

  // Load shift types for edit dropdown
  useEffect(() => {
    api.get('/api/master/shift-types', { params: { limit: 100 } })
      .then((res) => setShiftTypes(res.data.items || []))
      .catch(() => {});
  }, []);

  const fetchData = useCallback(async () => {
    if (!dateRange || dateRange.length < 2) return;
    setLoading(true);
    try {
      const params = {
        start_date: dateRange[0].format('YYYY-MM-DD'),
        end_date: dateRange[1].format('YYYY-MM-DD'),
        limit: pagination.pageSize,
        offset: (pagination.current - 1) * pagination.pageSize,
      };
      if (employeeId) params.employee_id = employeeId;
      const { data } = await api.get('/api/hr/roster', { params });
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch (err) {
      message.error(err.response?.data?.detail || 'Failed to load roster');
    } finally {
      setLoading(false);
    }
  }, [dateRange, employeeId, pagination.current, pagination.pageSize]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleEditClick = (record) => {
    setEditItem(record);
    editForm.setFieldsValue({
      shift_type_id: record.shift_type_id || undefined,
      is_working_day: record.is_working_day,
      note: record.note || '',
    });
    setEditModalOpen(true);
  };

  const handleEditSubmit = async () => {
    try {
      const values = await editForm.validateFields();
      setEditLoading(true);
      await api.put(`/api/hr/roster/${editItem.id}`, {
        shift_type_id: values.shift_type_id || null,
        is_working_day: values.is_working_day,
        note: values.note || null,
      });
      message.success('อัปเดตตารางกะสำเร็จ');
      setEditModalOpen(false);
      fetchData();
    } catch (err) {
      if (err.response) {
        message.error(err.response?.data?.detail || 'เกิดข้อผิดพลาด');
      }
    } finally {
      setEditLoading(false);
    }
  };

  const columns = [
    {
      title: 'วันที่',
      dataIndex: 'roster_date',
      key: 'roster_date',
      width: 120,
      render: (v) => (
        <span style={{ fontFamily: 'monospace' }}>
          {dayjs(v).format('DD/MM (ddd)')}
        </span>
      ),
      sorter: (a, b) => a.roster_date.localeCompare(b.roster_date),
    },
    {
      title: 'พนักงาน',
      key: 'employee',
      width: 200,
      render: (_, r) => (
        <span style={{ fontWeight: 500 }}>
          {r.employee_name || '-'}
        </span>
      ),
    },
    {
      title: 'กะ',
      key: 'shift',
      width: 180,
      render: (_, r) => {
        if (!r.is_working_day) {
          return <Tag color="default">OFF</Tag>;
        }
        const code = r.shift_type_code || '-';
        const color = SHIFT_COLORS[code] || 'cyan';
        return (
          <Tag color={color}>
            {code}{r.shift_type_name ? ` — ${r.shift_type_name}` : ''}
          </Tag>
        );
      },
    },
    {
      title: 'ทำงาน',
      dataIndex: 'is_working_day',
      key: 'is_working_day',
      width: 80,
      align: 'center',
      render: (v) =>
        v ? (
          <span style={{ color: COLORS.success, fontWeight: 600 }}>Yes</span>
        ) : (
          <span style={{ color: COLORS.textMuted }}>No</span>
        ),
    },
    {
      title: 'Override',
      dataIndex: 'is_manual_override',
      key: 'is_manual_override',
      width: 90,
      align: 'center',
      render: (v) => (v ? <Tag color="volcano">Manual</Tag> : null),
    },
    {
      title: 'หมายเหตุ',
      dataIndex: 'note',
      key: 'note',
      ellipsis: true,
      render: (v) => v || <span style={{ color: COLORS.textMuted }}>-</span>,
    },
    {
      title: '',
      key: 'actions',
      width: 60,
      align: 'right',
      render: (_, record) =>
        can('hr.roster.create') ? (
          <Button
            type="text"
            size="small"
            icon={<Pencil size={14} />}
            onClick={() => handleEditClick(record)}
          />
        ) : null,
    },
  ];

  return (
    <div>
      <div
        style={{
          marginBottom: 16,
          display: 'flex',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          alignItems: 'flex-end',
        }}
      >
        <Space size={16} wrap>
          <div>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
              ช่วงวันที่
            </Text>
            <RangePicker
              value={dateRange}
              onChange={(val) => {
                if (val) setDateRange(val);
              }}
              style={{ width: 280 }}
            />
          </div>
          <EmployeeContextSelector value={employeeId} onChange={setEmployeeId} />
        </Space>

        <Space>
          <Button icon={<RefreshCw size={14} />} onClick={fetchData}>
            Refresh
          </Button>
          {can('hr.roster.create') && (
            <Button
              type="primary"
              icon={<Plus size={14} />}
              onClick={() => setGenerateOpen(true)}
            >
              Generate Roster
            </Button>
          )}
        </Space>
      </div>

      <Table
        loading={loading}
        dataSource={items}
        columns={columns}
        rowKey="id"
        locale={{
          emptyText: (
            <EmptyState
              message="No roster entries"
              hint="Click 'Generate Roster' to auto-create shift entries from work schedules"
            />
          ),
        }}
        pagination={{
          current: pagination.current,
          pageSize: pagination.pageSize,
          total,
          onChange: (page, pageSize) => setPagination({ current: page, pageSize }),
          showSizeChanger: true,
          showTotal: (t) => `Total ${t} items`,
        }}
        size="middle"
      />

      {/* Generate Roster Modal */}
      <RosterGenerateModal
        open={generateOpen}
        onClose={() => setGenerateOpen(false)}
        onSuccess={() => {
          setGenerateOpen(false);
          fetchData();
        }}
      />

      {/* Edit Roster Entry Modal */}
      <Modal
        title={
          editItem
            ? `แก้ไขตารางกะ — ${editItem.employee_name} (${dayjs(editItem.roster_date).format('DD/MM/YYYY')})`
            : 'แก้ไขตารางกะ'
        }
        open={editModalOpen}
        onCancel={() => setEditModalOpen(false)}
        onOk={handleEditSubmit}
        confirmLoading={editLoading}
        okText="Save"
        cancelText="Cancel"
        width={420}
        destroyOnHidden
      >
        <Form form={editForm} layout="vertical">
          <Form.Item name="shift_type_id" label="กะ">
            <Select
              allowClear
              placeholder="OFF (วันหยุด)"
              options={shiftTypes
                .filter((s) => s.is_active)
                .map((s) => ({
                  label: `${s.code} — ${s.name} (${s.start_time?.slice(0, 5)}-${s.end_time?.slice(0, 5)})`,
                  value: s.id,
                }))}
            />
          </Form.Item>
          <Form.Item name="is_working_day" label="วันทำงาน">
            <Select
              options={[
                { value: true, label: 'ทำงาน (Working Day)' },
                { value: false, label: 'หยุด (Day Off)' },
              ]}
            />
          </Form.Item>
          <Form.Item name="note" label="หมายเหตุ">
            <Input placeholder="Optional note" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

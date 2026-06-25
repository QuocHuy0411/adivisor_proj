import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import AppLayout from '../components/AppLayout.jsx';
import DataTable from '../components/DataTable.jsx';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    api.get('/notifications').then((res) => setNotifications(res.data));
  }, []);

  return (
    <AppLayout title="Thông báo">
      <section className="panel">
        <DataTable pageSize={10} columns={[
          { key: 'ngay_gui', label: 'Ngày gửi', width: '14%', minWidth: '140px' },
          { key: 'tieu_de', label: 'Tiêu đề', width: '26%', minWidth: '220px' },
          { key: 'noi_dung', label: 'Nội dung', width: '60%', minWidth: '360px' }
        ]} rows={notifications} />
      </section>
    </AppLayout>
  );
}

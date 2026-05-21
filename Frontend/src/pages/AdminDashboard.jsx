import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import AppLayout from '../components/AppLayout.jsx';
import DataTable from '../components/DataTable.jsx';

const csvNotes = {
  heads: 'File CSV bắt buộc gồm: Mã nhân viên, Họ và tên, Email, Khoa. Khoa phải ghi đầy đủ, ví dụ: Công nghệ thông tin.',
  advisors: 'File CSV bắt buộc gồm: Mã cố vấn, Họ và tên, Số điện thoại, Email, Khoa, Chuyên ngành, Ưu tiên. Khoa phải ghi đầy đủ, ví dụ: Công nghệ thông tin.'
};

function CsvCreatePanel({ title, note, endpoint, onDone, onError }) {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (!file) return;
    setBusy(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const { data } = await api.post(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setFile(null);
      event.target.reset();
      onDone(data.message);
    } catch (err) {
      onError(err.response?.data?.message || 'Không import được file CSV');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="panel import-panel" onSubmit={submit}>
      <h2>{title}</h2>
      <p>{note}</p>
      <input type="file" accept=".csv,text/csv" onChange={(event) => setFile(event.target.files?.[0] || null)} />
      <button disabled={!file || busy}>{busy ? 'Đang tạo...' : 'Tạo'}</button>
    </form>
  );
}

export default function AdminDashboard() {
  const [faculties, setFaculties] = useState([]);
  const [selectedFaculty, setSelectedFaculty] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function loadFaculties() {
    const { data } = await api.get('/admin/faculties');
    setFaculties(data);
  }

  async function openEmployees(faculty) {
    setSelectedFaculty(faculty);
    const { data } = await api.get(`/admin/faculties/${faculty.ma_khoa}/employees`);
    setEmployees(data);
    setModalOpen(true);
  }

  useEffect(() => { loadFaculties(); }, []);

  async function afterCreate(nextMessage) {
    setMessage(nextMessage);
    setError('');
    await loadFaculties();
    if (selectedFaculty) {
      const { data } = await api.get(`/admin/faculties/${selectedFaculty.ma_khoa}/employees`);
      setEmployees(data);
    }
  }

  async function toggleAccount(row) {
    if (!row.ma_tai_khoan) return;
    try {
      const { data } = await api.patch(`/admin/accounts/${row.ma_tai_khoan}/status`, { is_active: !row.is_active });
      setMessage(data.message);
      setError('');
      if (selectedFaculty) await openEmployees(selectedFaculty);
    } catch (err) {
      setError(err.response?.data?.message || 'Không cập nhật được trạng thái tài khoản');
    }
  }

  return (
    <AppLayout title="Quản trị hệ thống">
      {message ? <div className="success">{message}</div> : null}
      {error ? <div className="error">{error}</div> : null}

      <section className="grid-2">
        <CsvCreatePanel
          title="Tạo tài khoản Trưởng Khoa"
          note={csvNotes.heads}
          endpoint="/admin/faculty-heads/import"
          onDone={afterCreate}
          onError={(nextError) => {
            setError(nextError);
            setMessage('');
          }}
        />
        <CsvCreatePanel
          title="Tạo thông tin và tài khoản Cố vấn học tập"
          note={csvNotes.advisors}
          endpoint="/admin/advisors/full/import"
          onDone={afterCreate}
          onError={(nextError) => {
            setError(nextError);
            setMessage('');
          }}
        />
      </section>

      <section className="panel">
        <h2>Danh sách nhân viên</h2>
        <DataTable
          columns={[
            { key: 'ma_khoa', label: 'Mã khoa' },
            { key: 'ten_khoa', label: 'Khoa' }
          ]}
          rows={faculties}
          actions={(row) => (
            <button onClick={() => openEmployees(row)}>Xem nhân viên</button>
          )}
        />
      </section>

      {modalOpen ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <section className="modal-panel">
            <header className="modal-header">
              <h2>{selectedFaculty ? `Nhân viên khoa ${selectedFaculty.ten_khoa}` : 'Danh sách nhân viên'}</h2>
              <button className="secondary" type="button" onClick={() => setModalOpen(false)}>Đóng</button>
            </header>
            <DataTable
              columns={[
                { key: 'ma', label: 'Mã' },
                { key: 'ho_va_ten', label: 'Họ tên' },
                { key: 'chuyen_nganh', label: 'Chuyên ngành', render: (row) => row.chuyen_nganh || '-' },
                { key: 'email', label: 'Email', render: (row) => row.email || 'Chưa có tài khoản' },
                { key: 'ten_tai_khoan', label: 'Tên tài khoản', render: (row) => row.ten_tai_khoan || 'Chưa có' },
                { key: 'vai_tro', label: 'Vai trò' },
                { key: 'is_active', label: 'Trạng thái', render: (row) => row.ma_tai_khoan ? (row.is_active ? 'Hoạt động' : 'Ngừng hoạt động') : 'Chưa có tài khoản' }
              ]}
              rows={employees}
              actions={(row) => (
                row.ma_tai_khoan ? (
                  <button onClick={() => toggleAccount(row)}>{row.is_active ? 'Khóa' : 'Mở'}</button>
                ) : <span className="hint">Chưa có tài khoản</span>
              )}
            />
          </section>
        </div>
      ) : null}
    </AppLayout>
  );
}

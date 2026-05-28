import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client.js';
import AppLayout from '../components/AppLayout.jsx';
import DataTable from '../components/DataTable.jsx';

const adminNav = [
  { key: 'create', label: 'Tạo tài khoản và thông tin' },
  { key: 'employees', label: 'Danh sách nhân viên' }
];

const csvNotes = {
  heads: 'File CSV bắt buộc gồm: Mã nhân viên, Họ và tên, Email, Khoa. Khoa phải ghi đầy đủ, ví dụ: Công nghệ thông tin.',
  ctsv: 'File CSV bắt buộc gồm: Mã nhân viên, Họ và tên, Email. Tên tài khoản là mã nhân viên (dùng để đăng nhập), mật khẩu là ctsv. Bắt buộc đổi mật khẩu lần đầu để sử dụng web.',
  advisors: 'File CSV bắt buộc gồm: Mã nhân viên, Họ và tên, Số điện thoại, Email, Khoa, Chuyên ngành, Ưu tiên. Khoa phải ghi đầy đủ, ví dụ: Công nghệ thông tin.'
};

function IconButton({ label, icon, tone, onClick }) {
  return (
    <button className={`icon-button ${tone || ''}`} type="button" title={label} aria-label={label} onClick={onClick}>
      {icon}
    </button>
  );
}

function Toast({ type, children, onClose }) {
  if (!children) return null;

  return (
    <div className="toast-wrap" role="status" aria-live="polite">
      <div className={`toast ${type}`}>
        <span>{children}</span>
        <button className="toast-close" type="button" aria-label="Đóng thông báo" onClick={onClose}>x</button>
      </div>
    </div>
  );
}

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

function AccountEditForm({ account, onCancel, onSave }) {
  const [form, setForm] = useState({ ho_va_ten: account.ho_va_ten || '', email: account.email || '' });

  function submit(event) {
    event.preventDefault();
    onSave(form);
  }

  return (
    <form className="edit-form" onSubmit={submit}>
      <h3>Sửa tài khoản nhân viên</h3>
      <div className="form-grid">
        <label>
          Họ tên
          <input value={form.ho_va_ten} onChange={(event) => setForm({ ...form, ho_va_ten: event.target.value })} />
        </label>
        <label>
          Email
          <input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
        </label>
      </div>
      <div className="modal-actions">
        <button className="secondary" type="button" onClick={onCancel}>Hủy</button>
        <button type="submit">Lưu</button>
      </div>
    </form>
  );
}

function AdvisorEditForm({ advisor, faculties, onCancel, onSave }) {
  const [form, setForm] = useState({
    ho_va_ten: advisor.ho_va_ten || '',
    so_dien_thoai: advisor.so_dien_thoai || '',
    ma_khoa: advisor.ma_khoa || '',
    chuyen_nganh: advisor.chuyen_nganh || ''
  });

  function submit(event) {
    event.preventDefault();
    onSave(form);
  }

  return (
    <form className="edit-form" onSubmit={submit}>
      <h3>Sửa thông tin cố vấn học tập</h3>
      <div className="form-grid">
        <label>
          Họ và tên
          <input value={form.ho_va_ten} onChange={(event) => setForm({ ...form, ho_va_ten: event.target.value })} />
        </label>
        <label>
          Số điện thoại
          <input value={form.so_dien_thoai} onChange={(event) => setForm({ ...form, so_dien_thoai: event.target.value })} />
        </label>
        <label>
          Khoa
          <select value={form.ma_khoa} onChange={(event) => setForm({ ...form, ma_khoa: event.target.value })}>
            {faculties.map((faculty) => (
              <option key={faculty.ma_don_vi} value={faculty.ma_don_vi}>{faculty.ten_don_vi}</option>
            ))}
          </select>
        </label>
        <label>
          Chuyên ngành
          <input value={form.chuyen_nganh} onChange={(event) => setForm({ ...form, chuyen_nganh: event.target.value })} />
        </label>
        <label>
          Ưu tiên
          <input value={advisor.uu_tien} disabled />
        </label>
      </div>
      <div className="modal-actions">
        <button className="secondary" type="button" onClick={onCancel}>Hủy</button>
        <button type="submit">Lưu</button>
      </div>
    </form>
  );
}

export default function AdminDashboard() {
  const [activeSection, setActiveSection] = useState('create');
  const [employeeGroups, setEmployeeGroups] = useState([]);
  const [selectedAccountGroup, setSelectedAccountGroup] = useState(null);
  const [employeeAccounts, setEmployeeAccounts] = useState([]);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [selectedAdvisorGroup, setSelectedAdvisorGroup] = useState(null);
  const [advisorRows, setAdvisorRows] = useState([]);
  const [advisorModalOpen, setAdvisorModalOpen] = useState(false);
  const [editingAdvisor, setEditingAdvisor] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const advisorGroups = useMemo(
    () => employeeGroups.filter((group) => group.ma_don_vi !== 'CTSV'),
    [employeeGroups]
  );

  async function loadEmployeeGroups() {
    const { data } = await api.get('/admin/employee-groups');
    setEmployeeGroups(data);
  }

  async function openEmployeeGroup(group) {
    setSelectedAccountGroup(group);
    const { data } = await api.get(`/admin/employee-groups/${group.ma_don_vi}/accounts`);
    setEmployeeAccounts(data);
    setEditingAccount(null);
    setAccountModalOpen(true);
  }

  async function openAdvisorGroup(group) {
    setSelectedAdvisorGroup(group);
    const { data } = await api.get(`/admin/advisor-groups/${group.ma_don_vi}/advisors`);
    setAdvisorRows(data);
    setEditingAdvisor(null);
    setAdvisorModalOpen(true);
  }

  useEffect(() => { loadEmployeeGroups(); }, []);

  useEffect(() => {
    if (!message && !error) return undefined;

    const timer = window.setTimeout(() => {
      setMessage('');
      setError('');
    }, 3000);

    return () => window.clearTimeout(timer);
  }, [message, error]);

  async function afterCreate(nextMessage) {
    setMessage(nextMessage);
    setError('');
    await loadEmployeeGroups();
    if (selectedAccountGroup) await openEmployeeGroup(selectedAccountGroup);
    if (selectedAdvisorGroup) await openAdvisorGroup(selectedAdvisorGroup);
  }

  async function toggleAccount(row) {
    if (!row.ma_tai_khoan) return;
    try {
      const { data } = await api.patch(`/admin/accounts/${row.ma_tai_khoan}/status`, { is_active: !row.is_active });
      setMessage(data.message);
      setError('');
      if (selectedAccountGroup) await openEmployeeGroup(selectedAccountGroup);
    } catch (err) {
      setError(err.response?.data?.message || 'Không cập nhật được trạng thái tài khoản');
    }
  }

  async function saveAccount(payload) {
    try {
      const { data } = await api.patch(`/admin/employee-accounts/${editingAccount.ma_tai_khoan}`, payload);
      setMessage(data.message);
      setError('');
      setEditingAccount(null);
      if (selectedAccountGroup) await openEmployeeGroup(selectedAccountGroup);
    } catch (err) {
      setError(err.response?.data?.message || 'Không cập nhật được tài khoản');
    }
  }

  async function deleteAccount(row) {
    if (!window.confirm(`Xóa tài khoản ${row.ten_tai_khoan}?`)) return;
    try {
      const { data } = await api.delete(`/admin/employee-accounts/${row.ma_tai_khoan}`);
      setMessage(data.message);
      setError('');
      if (selectedAccountGroup) await openEmployeeGroup(selectedAccountGroup);
    } catch (err) {
      setError(err.response?.data?.message || 'Không xóa được tài khoản');
    }
  }

  async function saveAdvisor(payload) {
    try {
      const { data } = await api.patch(`/admin/advisors/info/${editingAdvisor.ma_co_van}`, payload);
      setMessage(data.message);
      setError('');
      setEditingAdvisor(null);
      if (selectedAdvisorGroup) await openAdvisorGroup(selectedAdvisorGroup);
    } catch (err) {
      setError(err.response?.data?.message || 'Không cập nhật được thông tin CVHT');
    }
  }

  async function deleteAdvisor(row) {
    if (!window.confirm(`Xóa thông tin CVHT ${row.ho_va_ten} và tài khoản tương ứng?`)) return;
    try {
      const { data } = await api.delete(`/admin/advisors/info/${row.ma_co_van}`);
      setMessage(data.message);
      setError('');
      if (selectedAdvisorGroup) await openAdvisorGroup(selectedAdvisorGroup);
    } catch (err) {
      setError(err.response?.data?.message || 'Không xóa được thông tin CVHT');
    }
  }

  return (
    <AppLayout
      activeNav={activeSection}
      navItems={adminNav}
      onNavChange={setActiveSection}
      title={activeSection === 'create' ? 'Tạo tài khoản và thông tin' : 'Danh sách nhân viên'}
    >
      <Toast type={error ? 'error' : 'success'} onClose={() => {
        setMessage('');
        setError('');
      }}>
        {error || message}
      </Toast>

      {activeSection === 'create' ? (
        <section className="grid-3">
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
            title="Tạo tài khoản nhân viên phòng Công tác sinh viên"
            note={csvNotes.ctsv}
            endpoint="/admin/ctsv/import"
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
      ) : null}

      {activeSection === 'employees' ? (
        <div className="admin-list-grid">
          <section className="panel">
            <h2>Danh sách tài khoản nhân viên</h2>
            <DataTable
              pageSize={5}
              columns={[
                { key: 'ma_don_vi', label: 'Mã phòng/Khoa' },
                { key: 'ten_don_vi', label: 'Tên phòng/Khoa' }
              ]}
              rows={employeeGroups}
              actions={(row) => (
                <button onClick={() => openEmployeeGroup(row)}>Xem nhân viên</button>
              )}
            />
          </section>

          <section className="panel">
            <h2>Danh sách thông tin cố vấn học tập</h2>
            <DataTable
              pageSize={5}
              columns={[
                { key: 'ma_don_vi', label: 'Mã khoa' },
                { key: 'ten_don_vi', label: 'Tên khoa' }
              ]}
              rows={advisorGroups}
              actions={(row) => (
                <button onClick={() => openAdvisorGroup(row)}>Xem cố vấn</button>
              )}
            />
          </section>
        </div>
      ) : null}

      {accountModalOpen ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <section className="modal-panel">
            <header className="modal-header">
              <h2>{selectedAccountGroup ? `Tài khoản ${selectedAccountGroup.ten_don_vi}` : 'Danh sách tài khoản'}</h2>
              <button className="secondary" type="button" onClick={() => setAccountModalOpen(false)}>Đóng</button>
            </header>
            {editingAccount ? (
              <AccountEditForm account={editingAccount} onCancel={() => setEditingAccount(null)} onSave={saveAccount} />
            ) : null}
            <DataTable
              pageSize={5}
              columns={[
                { key: 'ma', label: 'Mã nhân viên' },
                { key: 'ho_va_ten', label: 'Họ tên' },
                { key: 'email', label: 'Email' },
                { key: 'ten_tai_khoan', label: 'Tên tài khoản' },
                { key: 'vai_tro', label: 'Vai trò' },
                {
                  key: 'trang_thai',
                  label: 'Trạng thái',
                  renderText: (row) => row.is_active ? 'Đang hoạt động' : 'Ngừng hoạt động',
                  render: (row) => (
                    <span className={`status-pill ${row.is_active ? 'active' : 'inactive'}`}>
                      {row.is_active ? 'Đang hoạt động' : 'Ngừng hoạt động'}
                    </span>
                  )
                }
              ]}
              rows={employeeAccounts}
              filterable
              actions={(row) => (
                <div className="icon-actions">
                  {row.loai_tai_khoan !== 'covan' ? (
                    <>
                      <IconButton icon="✎" label="Chỉnh sửa" onClick={() => setEditingAccount(row)} />
                      <IconButton icon="🗑" label="Xóa" tone="danger" onClick={() => deleteAccount(row)} />
                    </>
                  ) : null}
                  <IconButton icon={row.is_active ? '🔒' : '🔓'} label={row.is_active ? 'Khóa tài khoản' : 'Mở tài khoản'} onClick={() => toggleAccount(row)} />
                </div>
              )}
            />
          </section>
        </div>
      ) : null}

      {advisorModalOpen ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <section className="modal-panel advisor-modal">
            <header className="modal-header">
              <h2>{selectedAdvisorGroup ? `Cố vấn học tập ${selectedAdvisorGroup.ten_don_vi}` : 'Danh sách thông tin cố vấn'}</h2>
              <button className="secondary" type="button" onClick={() => setAdvisorModalOpen(false)}>Đóng</button>
            </header>
            {editingAdvisor ? (
              <AdvisorEditForm advisor={editingAdvisor} faculties={advisorGroups} onCancel={() => setEditingAdvisor(null)} onSave={saveAdvisor} />
            ) : null}
            <DataTable
              pageSize={5}
              columns={[
                { key: 'ma_co_van', label: 'Mã nhân viên' },
                { key: 'ho_va_ten', label: 'Họ và tên' },
                { key: 'email', label: 'Email' },
                { key: 'so_dien_thoai', label: 'Số điện thoại' },
                { key: 'chuyen_nganh', label: 'Chuyên ngành' },
                { key: 'uu_tien', label: 'Ưu tiên' }
              ]}
              rows={advisorRows}
              filterable
              actions={(row) => (
                <div className="icon-actions">
                  <IconButton icon="✎" label="Chỉnh sửa" onClick={() => setEditingAdvisor(row)} />
                  <IconButton icon="🗑" label="Xóa" tone="danger" onClick={() => deleteAdvisor(row)} />
                </div>
              )}
            />
          </section>
        </div>
      ) : null}
    </AppLayout>
  );
}

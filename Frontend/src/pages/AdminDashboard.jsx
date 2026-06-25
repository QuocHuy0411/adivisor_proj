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

const LockClosedIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
  </svg>
);

const LockOpenIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
    <path d="M7 11V7a5 5 0 0 1 9.9-1"></path>
  </svg>
);

const PenIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9"></path>
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
  </svg>
);

const TrashIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
    <line x1="10" y1="11" x2="10" y2="17"></line>
    <line x1="14" y1="11" x2="14" y2="17"></line>
  </svg>
);

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

// Form import CSV dung chung cho tao Truong Khoa, CTSV va goi thong tin + tai khoan CVHT.
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

// Modal sua tai khoan nhan vien cua Admin, chi cap nhat thong tin hien thi va email.
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

// Modal sua ho so CVHT rieng voi tai khoan, giu uu_tien do Khoa quan ly.
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

  // Nap cac nhom nhan vien theo don vi de Admin xem tong quan so luong nhan su tung khoa.
  async function loadEmployeeGroups() {
    const { data } = await api.get('/admin/employee-groups');
    setEmployeeGroups(data);
  }

  // Mo bang tai khoan nhan vien cua mot don vi, gom CTSV hoac Truong Khoa/CVHT trong khoa.
  async function openEmployeeGroup(group) {
    setSelectedAccountGroup(group);
    const { data } = await api.get(`/admin/employee-groups/${group.ma_don_vi}/accounts`);
    setEmployeeAccounts(data);
    setEditingAccount(null);
    setAccountModalOpen(true);
  }

  // Mo bang thong tin CVHT cua mot khoa de Admin sua/xoa ho so co van.
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

  // Sau khi import thanh cong, dong cac modal va tai lai thong ke nhan vien.
  async function afterCreate(nextMessage) {
    setMessage(nextMessage);
    setError('');
    setSelectedAccountGroup(null);
    setEmployeeAccounts([]);
    setAccountModalOpen(false);
    setEditingAccount(null);
    setSelectedAdvisorGroup(null);
    setAdvisorRows([]);
    setAdvisorModalOpen(false);
    setEditingAdvisor(null);
    await loadEmployeeGroups();
  }

  // Khoa/mo khoa tai khoan nhan vien ma khong xoa du lieu ho so lien quan.
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

  // Luu thay doi tai khoan nhan vien va tai lai bang dang mo de giu du lieu moi nhat.
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

  // Xoa tai khoan nhan vien sau xac nhan, backend se chan cac tai khoan khong duoc xoa.
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

  // Luu thay doi ho so CVHT va refresh bang CVHT cua khoa dang xem.
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

  // Xoa ho so CVHT sau xac nhan, bao gom tai khoan neu CVHT da duoc tao tai khoan.
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
                { key: 'ma_don_vi', label: 'Mã phòng/Khoa', width: '24%' },
                { key: 'ten_don_vi', label: 'Tên phòng/Khoa', width: '56%' },
                { key: 'so_luong_nhan_vien', label: 'Số lượng nhân viên', width: '20%', type: 'number' }
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
                { key: 'ma_don_vi', label: 'Mã khoa', width: '24%' },
                { key: 'ten_don_vi', label: 'Tên khoa', width: '56%' },
                { key: 'so_luong_co_van', label: 'Số lượng nhân viên', width: '20%', type: 'number' }
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
                { key: 'ma', label: 'Mã nhân viên', width: '14%' },
                { key: 'ho_va_ten', label: 'Họ tên', width: '20%' },
                { key: 'email', label: 'Email', width: '24%', minWidth: '200px' },
                { key: 'ten_tai_khoan', label: 'Tên tài khoản', width: '16%' },
                { key: 'vai_tro', label: 'Vai trò', width: '12%' },
                {
                  key: 'trang_thai',
                  label: 'Trạng thái',
                  width: '14%',
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
                      <IconButton icon={<PenIcon />} label="Chỉnh sửa" onClick={() => setEditingAccount(row)} />
                      <IconButton icon={<TrashIcon />} label="Xóa" tone="danger" onClick={() => deleteAccount(row)} />
                    </>
                  ) : null}
                  <IconButton icon={row.is_active ? <LockClosedIcon /> : <LockOpenIcon />} label={row.is_active ? 'Khóa tài khoản' : 'Mở tài khoản'} onClick={() => toggleAccount(row)} />
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
                { key: 'ma_co_van', label: 'Mã nhân viên', width: '14%' },
                { key: 'ho_va_ten', label: 'Họ và tên', width: '20%' },
                { key: 'email', label: 'Email', width: '24%', minWidth: '200px' },
                { key: 'so_dien_thoai', label: 'Số điện thoại', width: '14%', type: 'number' },
                { key: 'chuyen_nganh', label: 'Chuyên ngành', width: '20%', minWidth: '180px' },
                { key: 'uu_tien', label: 'Ưu tiên', width: '8%', type: 'number' }
              ]}
              rows={advisorRows}
              filterable
              actions={(row) => (
                <div className="icon-actions">
                  <IconButton icon={<PenIcon />} label="Chỉnh sửa" onClick={() => setEditingAdvisor(row)} />
                  <IconButton icon={<TrashIcon />} label="Xóa" tone="danger" onClick={() => deleteAdvisor(row)} />
                </div>
              )}
            />
          </section>
        </div>
      ) : null}
    </AppLayout>
  );
}

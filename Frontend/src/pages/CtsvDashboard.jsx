import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api/client.js';
import AppLayout from '../components/AppLayout.jsx';
import DataTable from '../components/DataTable.jsx';
import Toast from '../components/Toast.jsx';

const sectionTitle = {
  create: 'Tạo lớp và sinh viên',
  students: 'Danh sách sinh viên',
  assignments: 'Danh sách phân công cố vấn',
  history: 'Lịch sử phân công'
};

const NO_ADVISOR = 'Chưa có cố vấn';
const CLOSED = 'Đã đóng';
const WAITING = 'Chờ phân công';
const ASSIGNED = 'Đã phân công';
const DIRECTOR_WAITING = 'Chờ giám đốc duyệt';
const REJECTED = 'Bị từ chối';

const SearchIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"></circle>
    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
  </svg>
);

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

function IconButton({ label, icon, tone, onClick, disabled }) {
  return (
    <button className={`icon-button ${tone || ''}`} type="button" title={label} aria-label={label} onClick={onClick} disabled={disabled}>
      {icon}
    </button>
  );
}

function ToastSlot({ message, error, clear }) {
  return <Toast message={error || message} type={error ? 'error' : 'success'} onClose={clear} />;
}

function CsvImportPanel({ title, hint, endpoint, onDone, onError }) {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (!file) return;
    setBusy(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await api.post(endpoint, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      onDone(data.message);
      setFile(null);
      event.target.reset();
    } catch (err) {
      onError(err.response?.data?.message || 'Không import được file CSV');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="panel import-panel" onSubmit={submit}>
      <h2>{title}</h2>
      <p>{hint}</p>
      <input type="file" accept=".csv,text/csv" onChange={(event) => setFile(event.target.files?.[0] || null)} />
      <button type="submit" disabled={!file || busy}>{busy ? 'Đang tạo...' : 'Import CSV'}</button>
    </form>
  );
}

function ClassEditForm({ classRow, onCancel, onSave }) {
  const [form, setForm] = useState({
    ten_lop: classRow.ten_lop || '',
    ma_khoa: classRow.ma_khoa || 'CNTT',
    chuyen_nganh: classRow.chuyen_nganh || '',
    nam_hoc: classRow.nam_hoc || '',
    trang_thai_lop: classRow.trang_thai_lop || ''
  });

  function submit(event) {
    event.preventDefault();
    onSave(form);
  }

  return (
    <form className="edit-form" onSubmit={submit}>
      <h3>Chỉnh sửa lớp</h3>
      <div className="form-grid">
        <label>Tên lớp<input value={form.ten_lop} onChange={(event) => setForm({ ...form, ten_lop: event.target.value })} /></label>
        <label>
          Khoa
          <select value={form.ma_khoa} onChange={(event) => setForm({ ...form, ma_khoa: event.target.value })}>
            <option value="CNTT">CNTT</option>
            <option value="VT">VT</option>
            <option value="QTKD">QTKD</option>
            <option value="KTDT">KTDT</option>
          </select>
        </label>
        <label>Chuyên ngành<input value={form.chuyen_nganh} onChange={(event) => setForm({ ...form, chuyen_nganh: event.target.value })} /></label>
        <label>Năm học<input value={form.nam_hoc} onChange={(event) => setForm({ ...form, nam_hoc: event.target.value })} /></label>
        <label>Trạng thái<input value={form.trang_thai_lop} onChange={(event) => setForm({ ...form, trang_thai_lop: event.target.value })} /></label>
      </div>
      <div className="modal-actions">
        <button className="secondary" type="button" onClick={onCancel}>Hủy</button>
        <button type="submit">Lưu</button>
      </div>
    </form>
  );
}

function StudentEditForm({ student, classes, onCancel, onSave }) {
  const [form, setForm] = useState({
    ho_va_ten: student.ho_va_ten || '',
    email: student.email || '',
    so_dien_thoai: student.so_dien_thoai || '',
    ma_lop: student.ma_lop || ''
  });

  function submit(event) {
    event.preventDefault();
    onSave(form);
  }

  return (
    <form className="edit-form" onSubmit={submit}>
      <h3>Chỉnh sửa sinh viên</h3>
      <div className="form-grid">
        <label>Họ và tên<input value={form.ho_va_ten} onChange={(event) => setForm({ ...form, ho_va_ten: event.target.value })} /></label>
        <label>Email<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
        <label>Số điện thoại<input value={form.so_dien_thoai} onChange={(event) => setForm({ ...form, so_dien_thoai: event.target.value })} /></label>
        <label>
          Lớp
          <select value={form.ma_lop} onChange={(event) => setForm({ ...form, ma_lop: event.target.value })}>
            {classes.map((row) => <option key={row.ma_lop} value={row.ma_lop}>{row.ten_lop}</option>)}
          </select>
        </label>
      </div>
      <div className="modal-actions">
        <button className="secondary" type="button" onClick={onCancel}>Hủy</button>
        <button type="submit">Lưu</button>
      </div>
    </form>
  );
}

function yearRank(value) {
  return Number(String(value || '').slice(0, 4)) || 0;
}

function classRank(value) {
  const match = String(value || '').match(/(\d+)$/);
  return match ? Number(match[1]) : 0;
}

function downloadTable(rows, columns, fileName, type) {
  const escapeCell = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  if (type === 'xls') {
    const html = `<table><thead><tr>${columns.map((column) => `<th>${column.label}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => (
      `<tr>${columns.map((column) => `<td>${column.value(row) ?? ''}</td>`).join('')}</tr>`
    )).join('')}</tbody></table>`;
    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    triggerDownload(blob, `${fileName}.xls`);
    return;
  }
  const csv = [
    columns.map((column) => escapeCell(column.label)).join(','),
    ...rows.map((row) => columns.map((column) => escapeCell(column.value(row))).join(','))
  ].join('\n');
  triggerDownload(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' }), `${fileName}.csv`);
}

function triggerDownload(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export default function CtsvDashboard() {
  const [searchParams] = useSearchParams();
  const [classes, setClasses] = useState([]);
  const [classGroups, setClassGroups] = useState([]);
  const [students, setStudents] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [requests, setRequests] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [studentClass, setStudentClass] = useState(null);
  const [accountClass, setAccountClass] = useState(null);
  const [assignmentGroup, setAssignmentGroup] = useState(null);
  const [editingClass, setEditingClass] = useState(null);
  const [editingStudent, setEditingStudent] = useState(null);
  const [assignmentActionBusy, setAssignmentActionBusy] = useState('');
  const [replacementActionBusy, setReplacementActionBusy] = useState('');
  const [assignmentExportType, setAssignmentExportType] = useState('csv');
  const [replacementExportType, setReplacementExportType] = useState('csv');

  const activeSection = ['create', 'students', 'assignments', 'history'].includes(searchParams.get('view'))
    ? searchParams.get('view')
    : 'create';

  const clearToast = () => { setMessage(''); setError(''); };
  const showMessage = (nextMessage) => { setMessage(nextMessage); setError(''); };
  const showError = (nextError) => { setError(nextError); setMessage(''); };

  async function load() {
    const [classGroupRes, classRes, studentRes, assignmentRes, requestRes] = await Promise.all([
      api.get('/ctsv/class-groups'),
      api.get('/ctsv/classes'),
      api.get('/ctsv/students'),
      api.get('/ctsv/assignments'),
      api.get('/ctsv/replacement-requests')
    ]);
    setClassGroups(classGroupRes.data);
    setClasses(classRes.data);
    setStudents(studentRes.data);
    setAssignments(assignmentRes.data);
    setRequests(requestRes.data);
  }

  useEffect(() => { load(); }, []);

  const classRows = useMemo(() => classes.map((row) => ({
    ...row,
    id: row.ma_lop,
    si_so: Number(row.so_sinh_vien_thuc_te ?? row.so_luong_sv ?? 0),
    hasStudents: Number(row.so_sinh_vien_thuc_te ?? row.so_luong_sv ?? 0) > 0
  })), [classes]);

  const classById = useMemo(() => Object.fromEntries(classRows.map((row) => [row.ma_lop, row])), [classRows]);

  const assignmentGroups = useMemo(() => {
    const map = new Map();
    for (const faculty of classGroups) {
      map.set(faculty.ma_khoa, {
        id: faculty.ma_khoa,
        ma_khoa: faculty.ma_khoa,
        ten_khoa: faculty.ten_khoa,
        ten_truong_khoa: faculty.ten_truong_khoa || '',
        so_lop: Number(faculty.so_lop || 0),
        assignments: [],
        classes: []
      });
    }
    for (const classRow of classRows) {
      if (!map.has(classRow.ma_khoa)) {
        map.set(classRow.ma_khoa, {
          id: classRow.ma_khoa,
          ma_khoa: classRow.ma_khoa,
          ten_khoa: classRow.ten_khoa,
          ten_truong_khoa: classRow.ten_truong_khoa || '',
          so_lop: 0,
          assignments: [],
          classes: []
        });
      }
      const group = map.get(classRow.ma_khoa);
      group.so_lop = group.classes.length + 1;
      group.classes.push(classRow);
      if (classRow.ten_truong_khoa) group.ten_truong_khoa = classRow.ten_truong_khoa;
    }
    for (const assignment of assignments) {
      const classRow = classById[assignment.ma_lop];
      const maKhoa = assignment.ma_khoa || classRow?.ma_khoa;
      if (!maKhoa) continue;
      if (!map.has(maKhoa)) {
        map.set(maKhoa, {
          id: maKhoa,
          ma_khoa: maKhoa,
          ten_khoa: assignment.ten_khoa || classRow?.ten_khoa || maKhoa,
          ten_truong_khoa: classRow?.ten_truong_khoa || '',
          so_lop: 0,
          assignments: [],
          classes: []
        });
      }
      map.get(maKhoa).assignments.push({ ...assignment, ten_khoa: assignment.ten_khoa || classRow?.ten_khoa || maKhoa });
    }
    return [...map.values()].map((group) => {
      const currentAssignments = group.assignments.filter((row) => [WAITING, ASSIGNED, DIRECTOR_WAITING, REJECTED].includes(row.trang_thai));
      const closedClassCount = group.classes.filter((row) => row.ma_co_van && row.trang_thai_lop === CLOSED).length;
      const directorWaitingCount = currentAssignments.filter((row) => row.trang_thai === DIRECTOR_WAITING).length;
      const waitingCount = group.classes.filter((row) => [WAITING, NO_ADVISOR].includes(row.trang_thai_lop)).length
        + currentAssignments.filter((row) => [WAITING, ASSIGNED, REJECTED].includes(row.trang_thai)).length;
      let trangThai = group.so_lop ? WAITING : 'Chưa có lớp';
      if (group.so_lop > 0 && closedClassCount >= group.so_lop) trangThai = CLOSED;
      else if (directorWaitingCount > 0 && waitingCount === 0) trangThai = DIRECTOR_WAITING;
      else if (waitingCount > 0) trangThai = WAITING;
      return { ...group, trang_thai: trangThai };
    }).sort((a, b) => a.ma_khoa.localeCompare(b.ma_khoa));
  }, [assignments, classById, classGroups, classRows]);

  const studentRows = studentClass ? students.filter((row) => row.ma_lop === studentClass.ma_lop) : [];
  const accountRows = accountClass ? students.filter((row) => row.ma_lop === accountClass.ma_lop) : [];
  const assignmentDetailRows = assignmentGroup
    ? classRows
      .filter((row) => row.ma_khoa === assignmentGroup.ma_khoa)
      .map((classRow) => {
        const classAssignments = assignments.filter((row) => row.ma_lop === classRow.ma_lop);
        const currentAssignment = classAssignments.find((row) => [WAITING, ASSIGNED, DIRECTOR_WAITING, REJECTED].includes(row.trang_thai));
        const closedAssignment = classRow.ma_co_van || classRow.trang_thai_lop === CLOSED
          ? classAssignments.find((row) => row.trang_thai === CLOSED)
          : null;
        const assignment = currentAssignment || closedAssignment;
        return {
          ...classRow,
          ...(assignment || {}),
          id: assignment?.ma_phan_cong || classRow.ma_lop,
          ma_phan_cong: assignment?.ma_phan_cong || '-',
          ten_lop: assignment?.ten_lop || classRow.ten_lop,
          ten_khoa: assignment?.ten_khoa || classRow.ten_khoa,
          ten_co_van: assignment?.ten_co_van || classRow.ten_co_van || '',
          trang_thai: assignment?.trang_thai || classRow.trang_thai_lop || NO_ADVISOR
        };
      })
    : [];
  const canResetAssignments = classRows.length > 0
    && classRows.every((row) => row.ma_co_van && row.trang_thai_lop === CLOSED)
    && assignments.every((row) => row.trang_thai === CLOSED);
  const hasDirectorWaitingAssignments = assignments.some((row) => row.trang_thai === DIRECTOR_WAITING);
  const pendingRequests = requests.filter((row) => ![CLOSED, REJECTED].includes(row.trang_thai));

  const assignmentHistory = assignments
    .filter((row) => row.trang_thai === CLOSED)
    .map((row) => ({ ...row, ten_khoa: row.ten_khoa || classById[row.ma_lop]?.ten_khoa || row.ma_khoa }))
    .sort((a, b) => yearRank(b.nam_hoc) - yearRank(a.nam_hoc)
      || String(b.ten_khoa || '').localeCompare(String(a.ten_khoa || ''))
      || classRank(b.ten_lop) - classRank(a.ten_lop)
      || String(b.ten_lop || '').localeCompare(String(a.ten_lop || '')));

  const replacementHistory = requests
    .filter((row) => row.trang_thai === CLOSED)
    .sort((a, b) => yearRank(b.nam_hoc) - yearRank(a.nam_hoc)
      || String(b.ten_khoa || '').localeCompare(String(a.ten_khoa || ''))
      || classRank(b.ten_lop) - classRank(a.ten_lop)
      || String(b.ten_lop || '').localeCompare(String(a.ten_lop || '')));

  async function safeAction(callback, fallback = 'Không thực hiện được thao tác') {
    try {
      const data = await callback();
      showMessage(data.message);
      await load();
    } catch (err) {
      showError(err.response?.data?.message || fallback);
    }
  }

  async function saveClass(payload) {
    await safeAction(async () => {
      const { data } = await api.patch(`/ctsv/classes/${editingClass.ma_lop}`, payload);
      setEditingClass(null);
      return data;
    }, 'Không cập nhật được lớp');
  }

  async function deleteClass(row) {
    if (!window.confirm(`Xóa lớp ${row.ten_lop}?`)) return;
    await safeAction(async () => {
      const { data } = await api.delete(`/ctsv/classes/${row.ma_lop}`);
      return data;
    }, 'Không xóa được lớp');
  }

  async function saveStudent(payload) {
    await safeAction(async () => {
      const { data } = await api.patch(`/ctsv/students/${editingStudent.ma_sinh_vien}`, payload);
      setEditingStudent(null);
      return data;
    }, 'Không cập nhật được sinh viên');
  }

  async function deleteStudent(row) {
    if (!window.confirm(`Xóa sinh viên ${row.ho_va_ten}?`)) return;
    await safeAction(async () => {
      const { data } = await api.delete(`/ctsv/students/${row.ma_sinh_vien}`);
      return data;
    }, 'Không xóa được sinh viên');
  }

  async function toggleStudentAccount(row) {
    await safeAction(async () => {
      const { data } = await api.patch(`/ctsv/students/${row.ma_sinh_vien}/account-status`, { is_active: !row.is_active });
      return data;
    }, 'Không cập nhật được trạng thái tài khoản sinh viên');
  }

  async function deleteAllStudents(row) {
    if (!window.confirm(`Xóa tất cả sinh viên của lớp ${row.ten_lop}?`)) return;
    await safeAction(async () => {
      const { data } = await api.delete(`/ctsv/classes/${row.ma_lop}/students`);
      setStudentClass(null);
      return data;
    }, 'Không xóa được danh sách sinh viên của lớp');
  }

  async function assignmentAction(url) {
    await safeAction(async () => {
      const { data } = await api.post(url);
      return data;
    });
  }

  async function assignmentBulkAction(url, busyKey) {
    setAssignmentActionBusy(busyKey);
    await safeAction(async () => {
      const { data } = await api.post(url);
      return data;
    });
    setAssignmentActionBusy('');
  }

  async function replacementBulkAction(url, busyKey) {
    setReplacementActionBusy(busyKey);
    await safeAction(async () => {
      const { data } = await api.post(url);
      return data;
    });
    setReplacementActionBusy('');
  }

  function exportAssignments() {
    const directorRows = assignments.filter((row) => row.trang_thai === DIRECTOR_WAITING);
    const allClosed = classRows.length > 0
      && classRows.every((row) => row.ma_co_van && row.trang_thai_lop === CLOSED);
    if (!directorRows.length && !allClosed) {
      showError('Chỉ xuất được danh sách chờ giám đốc duyệt hoặc kết quả khi tất cả lớp đã đóng');
      return;
    }
    const exportRows = directorRows.length
      ? directorRows
      : assignments.filter((row) => row.trang_thai === CLOSED);
    const rows = exportRows.map((row) => ({
      ...row,
      ten_khoa: row.ten_khoa || classById[row.ma_lop]?.ten_khoa || row.ma_khoa
    }));
    downloadTable(rows, [
      { label: 'Mã phân công', value: (row) => row.ma_phan_cong },
      { label: 'Lớp', value: (row) => row.ten_lop },
      { label: 'Khoa', value: (row) => row.ten_khoa },
      { label: 'Cố vấn học tập', value: (row) => row.ten_co_van || '' },
      { label: 'Năm học', value: (row) => row.nam_hoc },
      { label: 'Trạng thái', value: (row) => row.trang_thai }
    ], directorRows.length ? 'phan-cong-cho-giam-doc-duyet' : 'ket-qua-phan-cong', assignmentExportType);
  }

  function exportReplacements() {
    const rows = pendingRequests;
    downloadTable(rows, [
      { label: 'Mã yêu cầu', value: (row) => row.ma_yeu_cau },
      { label: 'Lớp', value: (row) => row.ten_lop },
      { label: 'Khoa', value: (row) => row.ten_khoa },
      { label: 'Cố vấn cũ', value: (row) => row.ten_co_van_cu || '' },
      { label: 'Cố vấn mới', value: (row) => row.ten_co_van_moi || '' },
      { label: 'Trạng thái', value: (row) => row.trang_thai }
    ], 'danh-sach-yeu-cau-thay-the', replacementExportType);
  }

  return (
    <AppLayout title={sectionTitle[activeSection]}>
      <ToastSlot message={message} error={error} clear={clearToast} />

      {activeSection === 'create' ? (
        <div className="grid-2">
          <CsvImportPanel
            title="Tạo lớp"
            endpoint="/ctsv/classes/import"
            hint="File CSV cần các cột: Mã lớp, Tên lớp, Mã khoa, Chuyên ngành. Ví dụ Mã khoa: CNTT, VT, QTKD, KTDT."
            onDone={(nextMessage) => safeAction(async () => ({ message: nextMessage }))}
            onError={showError}
          />
          <CsvImportPanel
            title="Tạo thông tin và tài khoản sinh viên"
            endpoint="/ctsv/students/import"
            hint="File CSV cần các cột: Mã sinh viên, Họ và tên, Email, Số điện thoại, Mã lớp."
            onDone={(nextMessage) => safeAction(async () => ({ message: nextMessage }))}
            onError={showError}
          />
        </div>
      ) : null}

      {activeSection === 'students' ? (
        <section className="panel">
          <h2>Tài khoản và thông tin sinh viên</h2>
          <DataTable pageSize={10} columns={[
            { key: 'ma_lop', label: 'Mã lớp' },
            { key: 'ten_lop', label: 'Tên lớp' },
            { key: 'ten_khoa', label: 'Tên khoa' },
            { key: 'chuyen_nganh', label: 'Chuyên ngành' },
            { key: 'si_so', label: 'Sỉ số' }
          ]} rows={classRows} filterable actions={(row) => (
            <>
              <button type="button" onClick={() => setStudentClass(row)}>Thông tin</button>
              <button type="button" onClick={() => setAccountClass(row)}>Tài khoản</button>
              <div className="icon-actions">
                <IconButton icon={<PenIcon />} label="Chỉnh sửa lớp" disabled={row.hasStudents} onClick={() => setEditingClass(row)} />
                <IconButton icon={<TrashIcon />} label="Xóa lớp" tone="danger" disabled={row.hasStudents} onClick={() => deleteClass(row)} />
              </div>
            </>
          )} />
        </section>
      ) : null}

      {activeSection === 'assignments' ? (
        <>
          <section className="panel">
            <div className="panel-header">
              <h2>Phân công</h2>
              <div className="panel-actions">
                <button
                  className="secondary"
                  disabled={Boolean(assignmentActionBusy) || !canResetAssignments}
                  title={canResetAssignments ? 'Làm mới danh sách phân công' : 'Chỉ làm mới khi tất cả lớp đã được duyệt'}
                  type="button"
                  onClick={() => assignmentBulkAction('/ctsv/classes/reset-advisors', 'reset')}
                >
                  {assignmentActionBusy === 'reset' ? 'Đang làm mới...' : 'Làm mới'}
                </button>
                <button disabled={Boolean(assignmentActionBusy)} type="button" onClick={() => assignmentBulkAction('/ctsv/classes/send-to-faculties', 'send')}>
                  {assignmentActionBusy === 'send' ? 'Đang gửi...' : 'Gửi yêu cầu'}
                </button>
                <button disabled={Boolean(assignmentActionBusy) || !hasDirectorWaitingAssignments} type="button" onClick={() => assignmentBulkAction('/ctsv/assignments/approve-all', 'approve')}>
                  {assignmentActionBusy === 'approve' ? 'Đang duyệt...' : 'Duyệt tất cả'}
                </button>
                <button className="secondary" disabled={Boolean(assignmentActionBusy) || !hasDirectorWaitingAssignments} type="button" onClick={() => assignmentBulkAction('/ctsv/assignments/reject-all', 'reject')}>
                  {assignmentActionBusy === 'reject' ? 'Đang từ chối...' : 'Từ chối tất cả'}
                </button>
              </div>
            </div>
            <DataTable pageSize={4} columns={[
              { key: 'ma_khoa', label: 'Mã khoa' },
              { key: 'ten_khoa', label: 'Tên khoa' },
              { key: 'ten_truong_khoa', label: 'Trưởng khoa', render: (row) => row.ten_truong_khoa || '-' },
              { key: 'so_lop', label: 'Số lớp' },
              { key: 'trang_thai', label: 'Trạng thái' }
            ]} rows={assignmentGroups} actionLabel="" actions={(row) => (
              <div className="icon-actions">
                <IconButton icon={<SearchIcon />} label="Xem lớp" onClick={() => setAssignmentGroup(row)} />
              </div>
            )} />
            <div className="panel-footer-actions">
              <select value={assignmentExportType} onChange={(event) => setAssignmentExportType(event.target.value)}>
                <option value="csv">CSV</option>
                <option value="xls">XLS</option>
              </select>
              <button type="button" onClick={exportAssignments}>Xuất tệp</button>
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <h2>Yêu cầu thay thế</h2>
              <div className="panel-actions">
                <button disabled={Boolean(replacementActionBusy)} type="button" onClick={() => replacementBulkAction('/ctsv/replacement-requests/approve-all', 'approve')}>
                  {replacementActionBusy === 'approve' ? 'Đang duyệt...' : 'Duyệt tất cả'}
                </button>
                <button className="secondary" disabled={Boolean(replacementActionBusy)} type="button" onClick={() => replacementBulkAction('/ctsv/replacement-requests/reject-all', 'reject')}>
                  {replacementActionBusy === 'reject' ? 'Đang từ chối...' : 'Từ chối tất cả'}
                </button>
              </div>
            </div>
            <DataTable pageSize={3} columns={[
              { key: 'ma_yeu_cau', label: 'Mã yêu cầu' },
              { key: 'ten_lop', label: 'Lớp' },
              { key: 'ten_khoa', label: 'Khoa', render: (row) => row.ten_khoa || row.ma_khoa },
              { key: 'ten_co_van_cu', label: 'Cố vấn cũ' },
              { key: 'ten_co_van_moi', label: 'Cố vấn mới', render: (row) => row.ten_co_van_moi || '-' },
              { key: 'trang_thai', label: 'Trạng thái' }
            ]} rows={pendingRequests} filterable actionLabel="" actions={(row) => (
              <>
                {row.trang_thai === 'Khoa đã duyệt' ? <button onClick={() => assignmentAction(`/ctsv/replacement-requests/${row.ma_yeu_cau}/approve`)}>Duyệt và Gửi thông báo</button> : null}
                {row.trang_thai === 'Khoa đã duyệt' ? <button className="secondary" onClick={() => assignmentAction(`/ctsv/replacement-requests/${row.ma_yeu_cau}/reject`)}>Không duyệt</button> : null}
              </>
            )} />
            <div className="panel-footer-actions">
              <select value={replacementExportType} onChange={(event) => setReplacementExportType(event.target.value)}>
                <option value="csv">CSV</option>
                <option value="xls">XLS</option>
              </select>
              <button type="button" onClick={exportReplacements}>Xuất tệp</button>
            </div>
          </section>
        </>
      ) : null}

      {activeSection === 'history' ? (
        <>
          <section className="panel">
            <h2>Lịch sử phân công</h2>
            <DataTable filterable pageSize={3} columns={[
              { key: 'ma_phan_cong', label: 'Mã phân công' },
              { key: 'ten_lop', label: 'Lớp' },
              { key: 'ten_khoa', label: 'Khoa' },
              { key: 'ten_truong_khoa', label: 'Trưởng khoa', render: (row) => row.ten_truong_khoa || '-' },
              { key: 'ten_co_van', label: 'Cố vấn học tập', render: (row) => row.ten_co_van || '-' },
              { key: 'nam_hoc', label: 'Năm học' }
            ]} rows={assignmentHistory} />
          </section>
          <section className="panel">
            <h2>Lịch sử thay thế</h2>
            <DataTable filterable pageSize={3} columns={[
              { key: 'ma_yeu_cau', label: 'Mã yêu cầu' },
              { key: 'ten_lop', label: 'Lớp' },
              { key: 'ten_khoa', label: 'Khoa', render: (row) => row.ten_khoa || row.ma_khoa },
              { key: 'ten_truong_khoa', label: 'Trưởng khoa', render: (row) => row.ten_truong_khoa || '-' },
              { key: 'ten_co_van_cu', label: 'Cố vấn cũ' },
              { key: 'ten_co_van_moi', label: 'Cố vấn mới', render: (row) => row.ten_co_van_moi || '-' },
              { key: 'nam_hoc', label: 'Năm học', render: (row) => row.nam_hoc || '-' }
            ]} rows={replacementHistory} />
          </section>
        </>
      ) : null}

      {accountClass ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <section className="modal-panel">
            <header className="modal-header">
              <h2>Tài khoản sinh viên lớp {accountClass.ten_lop}</h2>
              <button className="secondary" type="button" onClick={() => setAccountClass(null)}>Đóng</button>
            </header>
            <DataTable pageSize={10} columns={[
              { key: 'ma_sinh_vien', label: 'Mã số sinh viên' },
              { key: 'ho_va_ten', label: 'Họ và tên' },
              { key: 'email', label: 'Email' },
              { key: 'ten_tai_khoan', label: 'Tên tài khoản' },
              {
                key: 'is_active',
                label: 'Trạng thái',
                renderText: (row) => row.is_active ? 'Đang hoạt động' : 'Ngừng hoạt động',
                render: (row) => row.is_active ? 'Đang hoạt động' : 'Ngừng hoạt động'
              }
            ]} rows={accountRows} filterable actionLabel="" actions={(row) => (
              <div className="icon-actions">
                <IconButton icon={row.is_active ? <LockClosedIcon /> : <LockOpenIcon />} label={row.is_active ? 'Khóa tài khoản' : 'Mở khóa tài khoản'} onClick={() => toggleStudentAccount(row)} />
              </div>
            )} />
          </section>
        </div>
      ) : null}

      {studentClass ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <section className="modal-panel">
            <header className="modal-header">
              <h2>Thông tin sinh viên lớp {studentClass.ten_lop}</h2>
              <div className="modal-actions">
                <button className="secondary" type="button" onClick={() => deleteAllStudents(studentClass)}>Xóa tất cả</button>
                <button className="secondary" type="button" onClick={() => { setStudentClass(null); setEditingStudent(null); }}>Đóng</button>
              </div>
            </header>
            {editingStudent ? (
              <StudentEditForm student={editingStudent} classes={classes} onCancel={() => setEditingStudent(null)} onSave={saveStudent} />
            ) : null}
            <DataTable pageSize={10} columns={[
              { key: 'ma_sinh_vien', label: 'Mã sinh viên' },
              { key: 'ho_va_ten', label: 'Tên sinh viên' },
              { key: 'email', label: 'Email' },
              { key: 'so_dien_thoai', label: 'Số điện thoại' }
            ]} rows={studentRows} filterable actionLabel="" actions={(row) => (
              <div className="icon-actions">
                <IconButton icon={<PenIcon />} label="Chỉnh sửa sinh viên" onClick={() => setEditingStudent(row)} />
                <IconButton icon={<TrashIcon />} label="Xóa sinh viên" tone="danger" onClick={() => deleteStudent(row)} />
              </div>
            )} />
          </section>
        </div>
      ) : null}

      {assignmentGroup ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <section className="modal-panel">
            <header className="modal-header">
              <h2>Danh sách lớp khoa {assignmentGroup.ten_khoa}</h2>
              <button className="secondary" type="button" onClick={() => setAssignmentGroup(null)}>Đóng</button>
            </header>
            <DataTable pageSize={4} columns={[
              { key: 'ma_phan_cong', label: 'Mã phân công' },
              { key: 'ten_lop', label: 'Tên lớp' },
              { key: 'ten_khoa', label: 'Khoa' },
              { key: 'ten_co_van', label: 'Cố vấn học tập', render: (row) => row.ten_co_van || '-' },
              { key: 'trang_thai', label: 'Trạng thái' }
            ]} rows={assignmentDetailRows} filterable actions={(row) => (
              <>
                {row.ma_phan_cong !== '-' && row.trang_thai === DIRECTOR_WAITING ? <button onClick={() => assignmentAction(`/ctsv/assignments/${row.ma_phan_cong}/approve`)}>Duyệt</button> : null}
                {row.ma_phan_cong !== '-' && row.trang_thai === DIRECTOR_WAITING ? <button className="secondary" onClick={() => assignmentAction(`/ctsv/assignments/${row.ma_phan_cong}/reject`)}>Từ chối</button> : null}
              </>
            )} />
          </section>
        </div>
      ) : null}

      {editingClass ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <section className="modal-panel">
            <header className="modal-header">
              <h2>Chỉnh sửa lớp {editingClass.ten_lop}</h2>
              <button className="secondary" type="button" onClick={() => setEditingClass(null)}>Đóng</button>
            </header>
            <ClassEditForm classRow={editingClass} onCancel={() => setEditingClass(null)} onSave={saveClass} />
          </section>
        </div>
      ) : null}
    </AppLayout>
  );
}

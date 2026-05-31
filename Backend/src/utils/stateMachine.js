import { badRequest } from './httpError.js';

export const LOP = {
  CHUA_CO_CVHT: 'Chưa có cố vấn',
  LOP_TRONG: 'Lớp trống',
  CHO_PHAN_CONG: 'Chờ phân công',
  DANG_PHAN_CONG: 'Đang phân công',
  DA_CO_CVHT: 'Đã có cố vấn',
  DA_DONG: 'Đã đóng',
  BI_TU_CHOI: 'Bị từ chối'
};

export const PHAN_CONG = {
  CHO_PHAN_CONG: 'Chờ phân công',
  DA_PHAN_CONG: 'Đã phân công',
  CHO_GIAM_DOC_DUYET: 'Chờ giám đốc duyệt',
  DA_DONG: 'Đã đóng',
  BI_TU_CHOI: 'Bị từ chối'
};

export const YEU_CAU_THAY_THE = {
  CHO_DUYET: 'Chờ duyệt',
  KHOA_DANG_DUYET: 'Khoa đang duyệt',
  KHOA_DA_DUYET: 'Khoa đã duyệt',
  GIAM_DOC_DANG_DUYET: 'Giám đốc đang duyệt',
  GIAM_DOC_DA_DUYET: 'Giám đốc đã duyệt',
  DA_DONG: 'Đã đóng',
  BI_TU_CHOI: 'Bị từ chối',
  GIAM_DOC_TU_CHOI: 'Bị từ chối',
  KHOA_TU_CHOI: 'Bị từ chối',
  DA_DUYET_BUOC_1: 'Khoa đã duyệt',
  LEGACY_KHOA_DA_DUYET: 'Khoa đã duyệt',
  LEGACY_DA_DONG: 'Đã đóng',
  LEGACY_BI_TU_CHOI: 'Bị từ chối'
};

const transitions = {
  phanCong: {
    [PHAN_CONG.CHO_PHAN_CONG]: [PHAN_CONG.DA_PHAN_CONG],
    [PHAN_CONG.DA_PHAN_CONG]: [PHAN_CONG.CHO_GIAM_DOC_DUYET],
    [PHAN_CONG.CHO_GIAM_DOC_DUYET]: [PHAN_CONG.DA_DONG, PHAN_CONG.CHO_PHAN_CONG],
    [PHAN_CONG.DA_DONG]: []
  },
  thayThe: {
    [YEU_CAU_THAY_THE.CHO_DUYET]: [
      YEU_CAU_THAY_THE.KHOA_DANG_DUYET,
      YEU_CAU_THAY_THE.KHOA_DA_DUYET,
      YEU_CAU_THAY_THE.BI_TU_CHOI
    ],
    [YEU_CAU_THAY_THE.KHOA_DANG_DUYET]: [
      YEU_CAU_THAY_THE.KHOA_DA_DUYET,
      YEU_CAU_THAY_THE.BI_TU_CHOI
    ],
    [YEU_CAU_THAY_THE.KHOA_DA_DUYET]: [
      YEU_CAU_THAY_THE.GIAM_DOC_DANG_DUYET,
      YEU_CAU_THAY_THE.GIAM_DOC_DA_DUYET,
      YEU_CAU_THAY_THE.DA_DONG,
      YEU_CAU_THAY_THE.BI_TU_CHOI
    ],
    [YEU_CAU_THAY_THE.GIAM_DOC_DANG_DUYET]: [
      YEU_CAU_THAY_THE.GIAM_DOC_DA_DUYET,
      YEU_CAU_THAY_THE.DA_DONG,
      YEU_CAU_THAY_THE.BI_TU_CHOI
    ],
    [YEU_CAU_THAY_THE.GIAM_DOC_DA_DUYET]: [YEU_CAU_THAY_THE.DA_DONG],
    [YEU_CAU_THAY_THE.BI_TU_CHOI]: [],
    [YEU_CAU_THAY_THE.DA_DONG]: [],
    [YEU_CAU_THAY_THE.LEGACY_DA_DONG]: [],
    [YEU_CAU_THAY_THE.LEGACY_BI_TU_CHOI]: []
  }
};

export function assertTransition(flow, from, to) {
  const allowed = transitions[flow]?.[from] || [];
  if (!allowed.includes(to)) {
    throw badRequest(`Chuyển trạng thái không hợp lệ: ${from} -> ${to}`);
  }
}

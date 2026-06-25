export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function notFound(message = 'Không tìm thấy dữ liệu') {
  return new HttpError(404, message);
}

export function badRequest(message = 'Dữ liệu không hợp lệ') {
  return new HttpError(400, message);
}

export function forbidden(message = 'Không có quyền thực hiện thao tác này') {
  return new HttpError(403, message);
}

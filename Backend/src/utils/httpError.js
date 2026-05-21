export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function notFound(message = 'Khong tim thay du lieu') {
  return new HttpError(404, message);
}

export function badRequest(message = 'Du lieu khong hop le') {
  return new HttpError(400, message);
}

export function forbidden(message = 'Khong co quyen thuc hien thao tac nay') {
  return new HttpError(403, message);
}

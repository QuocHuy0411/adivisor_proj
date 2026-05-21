export function errorHandler(error, req, res, next) {
  const status = error.status || 500;
  const message = status === 500 ? 'Loi he thong' : error.message;

  if (status === 500) {
    console.error(error);
  }

  res.status(status).json({
    message,
    detail: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
}

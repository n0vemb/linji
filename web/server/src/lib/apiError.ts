/**
 * 统一错误类型：路由里 throw new ApiError(404, '灵感不存在')，
 * 由 errorHandler 转成 { error: { message, status } } 响应体。
 */
export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export const notFound = (msg = '资源不存在') => new ApiError(404, msg);
export const badRequest = (msg = '请求参数有误') => new ApiError(400, msg);
export const forbidden = (msg = '没有权限执行该操作') => new ApiError(403, msg);
export const unauthorized = (msg = '请先登录') => new ApiError(401, msg);

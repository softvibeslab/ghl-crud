import { NextResponse } from 'next/server'

export interface ApiSuccessResponse<T> {
  success: true
  data: T
  meta?: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface ApiErrorResponse {
  success: false
  error: {
    message: string
    code?: string
  }
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse

export function successResponse<T>(
  data: T,
  meta?: { page: number; limit: number; total: number; totalPages: number },
  status: number = 200
): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json(
    {
      success: true as const,
      data,
      ...(meta && { meta }),
    },
    { status }
  )
}

export function errorResponse(
  message: string,
  status: number = 400,
  code?: string
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      success: false as const,
      error: {
        message,
        ...(code && { code }),
      },
    },
    { status }
  )
}

export function notFoundResponse(
  message: string = 'Resource not found'
): NextResponse<ApiErrorResponse> {
  return errorResponse(message, 404, 'NOT_FOUND')
}

export function validationErrorResponse(
  message: string
): NextResponse<ApiErrorResponse> {
  return errorResponse(message, 422, 'VALIDATION_ERROR')
}

export function internalErrorResponse(
  message: string = 'Internal server error'
): NextResponse<ApiErrorResponse> {
  return errorResponse(message, 500, 'INTERNAL_ERROR')
}

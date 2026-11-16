import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { executionModeSchema } from '@/application/dto/campaign-schemas';
import type { ExecutionMode } from '@/domain/entities/campaign';
import {
  AssetResolutionError,
  AssetUploadError,
  BudgetGuardrailError,
  InvalidWorkflowStateError,
  ProviderCapabilityError,
  ProviderConfigurationError,
  ProviderRequestError,
} from '@/domain/errors/domain-errors';

export function jsonOk<T>(payload: T, status = 200): NextResponse<T> {
  return NextResponse.json(payload, { status });
}

export function getRequestedMode(
  request: NextRequest,
): ExecutionMode | undefined {
  const rawMode = request.nextUrl.searchParams.get('mode');

  if (rawMode === null || rawMode.trim() === '') {
    return undefined;
  }

  return executionModeSchema.parse(rawMode);
}

export function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof BudgetGuardrailError) {
    return NextResponse.json(
      {
        error: {
          code: 'BUDGET_GUARDRAIL_EXCEEDED',
          message: error.message,
          details: {
            currentUsd: error.currentUsd,
            estimatedCostUsd: error.estimatedCostUsd,
            maxBudgetUsd: error.maxBudgetUsd,
            projectedUsd:
              Math.round(
                (error.currentUsd + error.estimatedCostUsd) * 1_000_000,
              ) / 1_000_000,
          },
        },
      },
      { status: 402 },
    );
  }

  if (error instanceof ProviderCapabilityError) {
    return NextResponse.json(
      {
        error: {
          code: 'PROVIDER_CAPABILITY_UNSUPPORTED',
          message: error.message,
          details: {
            modelId: error.modelId,
            reason: error.reason,
          },
        },
      },
      { status: 400 },
    );
  }

  if (error instanceof ProviderConfigurationError) {
    return NextResponse.json(
      {
        error: {
          code: 'PROVIDER_NOT_CONFIGURED',
          message: error.message,
          details: {
            provider: error.provider,
            missingEnvVar: error.missingEnvVar,
          },
        },
      },
      { status: 503 },
    );
  }

  if (error instanceof ProviderRequestError) {
    return NextResponse.json(
      {
        error: {
          code: 'PROVIDER_REQUEST_FAILED',
          message: error.message,
          details: {
            provider: error.provider,
            status: error.status,
            providerCode: error.providerCode ?? null,
            providerMessage: error.providerMessage,
          },
        },
      },
      { status: 502 },
    );
  }

  if (error instanceof AssetResolutionError) {
    return NextResponse.json(
      {
        error: {
          code: 'ASSET_RESOLUTION_FAILED',
          message: error.message,
          details: {
            reference: error.reference,
          },
        },
      },
      { status: 422 },
    );
  }

  if (error instanceof AssetUploadError) {
    return NextResponse.json(
      {
        error: {
          code: 'INVALID_ASSET_UPLOAD',
          message: error.message,
          details: {
            reason: error.reason,
          },
        },
      },
      { status: 400 },
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'The request payload is invalid.',
          details: {
            issues: error.issues.map((issue) => ({
              path: issue.path.map(String).join('.'),
              code: issue.code,
              message: issue.message,
            })),
          },
        },
      },
      { status: 400 },
    );
  }

  if (error instanceof InvalidWorkflowStateError) {
    return NextResponse.json(
      {
        error: {
          code: 'INVALID_WORKFLOW_STATE',
          message: error.message,
          details: {},
        },
      },
      { status: 409 },
    );
  }

  if (error instanceof SyntaxError) {
    return NextResponse.json(
      {
        error: {
          code: 'INVALID_JSON',
          message: 'The request body must contain valid JSON.',
          details: {},
        },
      },
      { status: 400 },
    );
  }

  console.error('[driftzero-api] Unhandled route error', error);

  return NextResponse.json(
    {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected server error occurred.',
        details: {},
      },
    },
    { status: 500 },
  );
}

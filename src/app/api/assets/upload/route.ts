import type { NextRequest } from 'next/server';
import { UploadProductAssetUseCase } from '@/application/use-cases/upload-product-asset';
import { AssetUploadError } from '@/domain/errors/domain-errors';
import {
  createMediaProviders,
  getExecutionMode,
} from '@/infrastructure/config/provider-factory';
import { getRequestedMode, jsonOk, toErrorResponse } from '../../_lib/http';

export async function POST(request: NextRequest) {
  try {
    const mode = getRequestedMode(request) ?? getExecutionMode();

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      throw new AssetUploadError(
        'The product anchor upload must use multipart/form-data.',
        'invalid-form-data',
      );
    }

    const file = formData.get('file');

    if (!(file instanceof File)) {
      throw new AssetUploadError(
        'Attach the product image under the "file" field.',
        'missing-file',
      );
    }

    const providers = createMediaProviders(mode);
    const useCase = new UploadProductAssetUseCase({
      storage: providers.storage,
    });

    const result = await useCase.execute({
      fileName: file.name,
      contentType: file.type,
      sizeBytes: file.size,
      base64Data: Buffer.from(await file.arrayBuffer()).toString('base64'),
      mode,
    });

    return jsonOk(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}

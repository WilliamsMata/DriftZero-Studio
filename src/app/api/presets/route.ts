import {
  PRODUCT_ANCHOR_OPTIONS,
  SHOWCASE_PRESETS,
} from '@/infrastructure/mocks/presets';
import { jsonOk } from '../_lib/http';

export async function GET() {
  return jsonOk({
    presets: SHOWCASE_PRESETS,
    productAnchors: PRODUCT_ANCHOR_OPTIONS,
  });
}

import { UploadLog } from './UploadLog';

export default function NeemansSaleUpload() {
  return <UploadLog endpoint="/sales/upload-neemans-sale-raw" table="neemans_sale_raw" title="Neemans Sale Raw Upload" />;
}

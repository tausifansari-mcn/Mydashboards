import { UploadLog } from './UploadLog';

export default function GncUpload() {
  return <UploadLog endpoint="/sales/upload-gnc" table="gnc_sale" title="GNC Sale Upload" />;
}

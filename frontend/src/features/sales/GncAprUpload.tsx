import { UploadLog } from './UploadLog';

export default function GncAprUpload() {
  return <UploadLog endpoint="/sales/upload-gnc-apr" table="gnc_apr" title="GNC APR Upload" />;
}

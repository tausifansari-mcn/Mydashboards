import { UploadLog } from './UploadLog';

export default function AwOutUpload() {
  return <UploadLog endpoint="/sales/upload-aw-out" table="aw_out" title="AW Outbound Performance Upload" />;
}

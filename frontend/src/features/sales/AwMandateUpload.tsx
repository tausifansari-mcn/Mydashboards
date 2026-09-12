import { UploadLog } from './UploadLog';

export default function AwMandateUpload() {
  return <UploadLog endpoint="/sales/upload-aw-mandate" table="aw_mandate" title="AW Mandate Upload" />;
}

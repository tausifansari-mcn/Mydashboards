import { UploadLog } from './UploadLog';

export default function AwNewCdrUpload() {
  return <UploadLog endpoint="/sales/upload-aw-new-cdr" table="aw_new_cdr" title="AW New CDR Upload" />;
}

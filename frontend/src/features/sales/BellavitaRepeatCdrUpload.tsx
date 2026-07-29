import { UploadLog } from './UploadLog';

export default function BellavitaRepeatCdrUpload() {
  return <UploadLog endpoint="/sales/upload-bellavita-repeat-cdr" table="bvo_Repeat_cdr" title="Repeat CDR" />;
}

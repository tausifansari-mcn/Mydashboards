import { UploadLog } from './UploadLog';

export default function BellavitaRepeatAllocationUpload() {
  return <UploadLog endpoint="/sales/upload-bellavita-repeat-allocation" table="bvo_repeat_allocation" title="Repeat Allocation" />;
}
